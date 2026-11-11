import type { PayloadRequest } from 'payload'

import { requireUser } from '@/lib/auth/requireActor'
import { withTransaction } from '@/lib/db/withTransaction'
import type { Order } from '@/payload-types'

import { assertOwnsOrder, lockOrder } from './shared'
import { assertTransition } from './transitions'

/** The student drops an order they will not pay. Only possible before or after review, not during. */
export async function cancelOrder(orderId: string, req: PayloadRequest): Promise<Order> {
  const user = requireUser(req)
  return withTransaction(req, async () => {
    const order = await lockOrder(orderId, req)
    assertOwnsOrder(order, user)
    assertTransition(order.status, 'cancelled')
    return req.payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'cancelled' },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })
}
