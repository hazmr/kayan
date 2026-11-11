import type { PayloadRequest } from 'payload'

import { requireStaff, requireUser } from '@/lib/auth/requireActor'
import { withTransaction } from '@/lib/db/withTransaction'
import { sendRefundDeclinedEmail, sendRefundedEmail } from '@/lib/email/orderEmails'
import { revokeEnrollment } from '@/lib/enrollments/enrollments'
import { AppError } from '@/lib/errors/AppError'
import type { Order } from '@/payload-types'

import { assertOwnsOrder, emailContextFor, lockOrder } from './shared'
import { assertTransition } from './transitions'

// Refunds are decided case by case by a manager (see the refund policy page). The student asks,
// the manager sends the money back by hand, and only THEN marks the order refunded here.
// Until that moment the student keeps access and can withdraw the request.

function isRefundable(order: Order): boolean {
  return order.status === 'paid' && order.amount > 0
}

export async function requestRefund(
  orderId: string,
  input: { reason: string; refundTo: string },
  req: PayloadRequest,
): Promise<Order> {
  const user = requireUser(req)
  const reason = input.reason.trim()
  const refundTo = input.refundTo.trim()
  if (reason === '' || reason.length > 1000 || refundTo === '' || refundTo.length > 120) {
    throw new AppError('VALIDATION_FAILED')
  }

  return withTransaction(req, async () => {
    const order = await lockOrder(orderId, req)
    assertOwnsOrder(order, user)
    if (!isRefundable(order)) throw new AppError('REFUND_NOT_ALLOWED')
    if (order.refundStatus === 'requested') throw new AppError('REFUND_ALREADY_REQUESTED')

    return req.payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        refundStatus: 'requested',
        refundReason: reason,
        refundTo,
        refundRequestedAt: new Date().toISOString(),
        refundDecisionNote: null,
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })
}

export async function cancelRefundRequest(orderId: string, req: PayloadRequest): Promise<Order> {
  const user = requireUser(req)
  return withTransaction(req, async () => {
    const order = await lockOrder(orderId, req)
    assertOwnsOrder(order, user)
    if (order.refundStatus !== 'requested') throw new AppError('REFUND_NOT_ALLOWED')

    return req.payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        refundStatus: 'none',
        refundReason: null,
        refundTo: null,
        refundRequestedAt: null,
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })
}

/** The manager says no. The student keeps access and is told why. */
export async function declineRefund(
  orderId: string,
  note: string,
  req: PayloadRequest,
): Promise<Order> {
  requireStaff(req)
  const decisionNote = note.trim()
  if (decisionNote === '') throw new AppError('REVIEW_NOTE_REQUIRED')

  const order = await withTransaction(req, async () => {
    const current = await lockOrder(orderId, req)
    if (current.refundStatus !== 'requested') throw new AppError('REFUND_NOT_ALLOWED')
    return req.payload.update({
      collection: 'orders',
      id: current.id,
      data: { refundStatus: 'declined', refundDecisionNote: decisionNote },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })

  await sendRefundDeclinedEmail(await emailContextFor(order, req), decisionNote)
  return order
}

/**
 * Called only AFTER the manager has sent the money back. Marks the order refunded and takes the
 * student's access away. Safe to call twice: the second call changes nothing.
 */
export async function refundOrder(orderId: string, req: PayloadRequest): Promise<Order> {
  const manager = requireStaff(req)

  const { order, changed } = await withTransaction(req, async () => {
    const current = await lockOrder(orderId, req)
    if (current.status === 'refunded') return { order: current, changed: false }
    assertTransition(current.status, 'refunded')
    if (!isRefundable(current)) throw new AppError('REFUND_NOT_ALLOWED')

    await revokeEnrollment(current, req)
    const refunded = await req.payload.update({
      collection: 'orders',
      id: current.id,
      data: {
        status: 'refunded',
        refundedAt: new Date().toISOString(),
        refundedBy: manager.id,
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
    return { order: refunded, changed: true }
  })

  if (changed) await sendRefundedEmail(await emailContextFor(order, req))
  return order
}
