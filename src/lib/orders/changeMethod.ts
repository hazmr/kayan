import type { PayloadRequest } from 'payload'

import { requireUser } from '@/lib/auth/requireActor'
import { withTransaction } from '@/lib/db/withTransaction'
import { AppError } from '@/lib/errors/AppError'
import { availableMethods, getPaymentSettings } from '@/lib/payments/settings'
import type { Order } from '@/payload-types'

import { assertOwnsOrder, lockOrder } from './shared'
import type { PaymentMethod } from './transitions'

/** Lets the student switch between InstaPay and Vodafone Cash before they have paid. */
export async function changeMethod(
  orderId: string,
  method: PaymentMethod,
  req: PayloadRequest,
): Promise<Order> {
  const user = requireUser(req)
  const settings = await getPaymentSettings(req.payload)
  if (!availableMethods(settings).includes(method)) throw new AppError('PAYMENT_METHOD_UNAVAILABLE')

  return withTransaction(req, async () => {
    const order = await lockOrder(orderId, req)
    assertOwnsOrder(order, user)
    if (order.status !== 'pending') throw new AppError('ORDER_INVALID_STATE')
    return req.payload.update({
      collection: 'orders',
      id: order.id,
      data: { method },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })
}
