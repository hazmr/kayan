import { AppError } from '@/lib/errors/AppError'

import { manualProvider } from './manual'
import type { PaymentProvider } from './types'

// The only file that knows which payment adapters exist.
const providers: Partial<Record<PaymentProvider['id'], PaymentProvider>> = {
  manual: manualProvider,
  // paymob: paymobProvider,   <- adding Paymob later is this line plus its adapter file
}

export function getPaymentProvider(id: PaymentProvider['id']): PaymentProvider {
  const provider = providers[id]
  if (!provider) throw new AppError('PAYMENT_METHOD_UNAVAILABLE')
  return provider
}
