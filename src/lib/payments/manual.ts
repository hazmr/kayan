import { AppError } from '@/lib/errors/AppError'
import { PAYMENT_METHODS } from '@/lib/orders/transitions'

import { getPaymentSettings, payToFor } from './settings'
import type { PaymentProvider } from './types'

/**
 * InstaPay and Vodafone Cash by hand: there is no API, so "starting a payment" just means
 * showing the student where to send the money. A manager confirms it later by looking at
 * the receipt screenshot and the real account.
 */
export const manualProvider: PaymentProvider = {
  id: 'manual',
  async startPayment(order, { payload }) {
    const method = PAYMENT_METHODS.find((candidate) => candidate === order.method)
    if (!method) throw new AppError('PAYMENT_METHOD_UNAVAILABLE')

    const payTo = payToFor(method, await getPaymentSettings(payload))
    if (payTo === '') throw new AppError('PAYMENT_METHOD_UNAVAILABLE')

    return { kind: 'instructions', payTo, amount: order.amount, reference: order.reference }
  },
}
