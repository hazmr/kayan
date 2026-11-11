import type { PayloadRequest } from 'payload'

import { requireStaff } from '@/lib/auth/requireActor'
import { withTransaction } from '@/lib/db/withTransaction'
import { sendReceiptApprovedEmail, sendReceiptRejectedEmail } from '@/lib/email/orderEmails'
import { AppError } from '@/lib/errors/AppError'
import type { Order, User } from '@/payload-types'

import { fulfillInTransaction } from './fulfillOrder'
import { emailContextFor, lockOrder } from './shared'
import { assertTransition } from './transitions'

/** Records the decision on every receipt of this order that has not been reviewed yet. */
async function recordDecision(
  orderId: string,
  decision: 'approved' | 'rejected',
  reviewer: User,
  note: string | undefined,
  req: PayloadRequest,
): Promise<void> {
  await req.payload.update({
    collection: 'receipts',
    where: { and: [{ order: { equals: orderId } }, { decision: { exists: false } }] },
    data: {
      decision,
      reviewNote: note ?? null,
      reviewedBy: reviewer.id,
      reviewedAt: new Date().toISOString(),
    },
    overrideAccess: true,
    req,
  })
}

/**
 * A manager confirms the money arrived. The order becomes paid and the student gets access.
 * Approving twice is harmless: the second call sees "paid" and does nothing.
 */
export async function approveReceipt(orderId: string, req: PayloadRequest): Promise<Order> {
  const reviewer = requireStaff(req)

  const { order, changed } = await withTransaction(req, async () => {
    const current = await lockOrder(orderId, req)
    if (current.status === 'paid') return { order: current, changed: false }
    // Only an order with a receipt waiting is approved here. A free course never needs this.
    if (current.status !== 'awaiting_review') throw new AppError('ORDER_INVALID_STATE')

    await recordDecision(current.id, 'approved', reviewer, undefined, req)
    return { order: await fulfillInTransaction(current, req), changed: true }
  })

  if (changed) await sendReceiptApprovedEmail(await emailContextFor(order, req))
  return order
}

/** A manager could not find the payment. The student is told why and can upload a new receipt. */
export async function rejectReceipt(
  orderId: string,
  note: string,
  req: PayloadRequest,
): Promise<Order> {
  const reviewer = requireStaff(req)
  const reviewNote = note.trim()
  if (reviewNote === '') throw new AppError('REVIEW_NOTE_REQUIRED')

  const order = await withTransaction(req, async () => {
    const current = await lockOrder(orderId, req)
    assertTransition(current.status, 'rejected')
    await recordDecision(current.id, 'rejected', reviewer, reviewNote, req)
    return req.payload.update({
      collection: 'orders',
      id: current.id,
      data: { status: 'rejected' },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })

  await sendReceiptRejectedEmail(await emailContextFor(order, req), reviewNote)
  return order
}
