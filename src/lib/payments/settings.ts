import type { Payload } from 'payload'

import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/orders/transitions'

export interface PaymentSettingsValues {
  instapayAddress: string
  vodafoneCashNumber: string
}

/** Where students send money. Read on the server only; the settings API is staff-only. */
export async function getPaymentSettings(payload: Payload): Promise<PaymentSettingsValues> {
  const settings = await payload.findGlobal({ slug: 'payment-settings', overrideAccess: true })
  return {
    instapayAddress: settings.instapayAddress?.trim() ?? '',
    vodafoneCashNumber: settings.vodafoneCashNumber?.trim() ?? '',
  }
}

export function payToFor(method: PaymentMethod, settings: PaymentSettingsValues): string {
  return method === 'instapay' ? settings.instapayAddress : settings.vodafoneCashNumber
}

/** A method is offered to students only once its address or number is filled in. */
export function availableMethods(settings: PaymentSettingsValues): PaymentMethod[] {
  return PAYMENT_METHODS.filter((method) => payToFor(method, settings) !== '')
}
