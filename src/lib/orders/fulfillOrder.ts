import type { PayloadRequest } from 'payload'

import { activateEnrollment } from '@/lib/enrollments/enrollments'
import { withTransaction } from '@/lib/db/withTransaction'
import { AppError } from '@/lib/errors/AppError'
import type { Order } from '@/payload-types'

import { emailContextFor, lockOrder } from './shared'
import { sendReceiptApprovedEmail } from '@/lib/email/orderEmails'
import { assertTransition } from './transitions'

/**
 * Marks a locked order paid and gives the student access. The caller already holds the lock
 * and the transaction (see fulfillOrder, approveReceipt).
 */
export async function fulfillInTransaction(order: Order, req: PayloadRequest): Promise<Order> {
  assertTransition(order.status, 'paid')
  // The diagram lets a pending order jump to paid, but only a free one. A paid course must
  // go through a receipt and a manager.
  if (order.status === 'pending' && order.amount !== 0) throw new AppError('ORDER_INVALID_STATE')

  await activateEnrollment(order, req)
  return req.payload.update({
    collection: 'orders',
    id: order.id,
    data: { status: 'paid', paidAt: new Date().toISOString() },
    depth: 0,
    overrideAccess: true,
    req,
  })
}

/**
 * Marks the order paid and activates the enrollment. Safe to call twice: the second call
 * finds the order already paid and changes nothing. Manual approval calls this now; the
 * Paymob webhook will call it later.
 */
export async function fulfillOrder(orderId: string, req: PayloadRequest): Promise<Order> {
  const { order, changed } = await withTransaction(req, async () => {
    const current = await lockOrder(orderId, req)
    if (current.status === 'paid') return { order: current, changed: false }
    return { order: await fulfillInTransaction(current, req), changed: true }
  })

  // Sent only after the change is saved, so a failed email can never undo a payment.
  if (changed && order.amount > 0) await sendReceiptApprovedEmail(await emailContextFor(order, req))
  return order
}
