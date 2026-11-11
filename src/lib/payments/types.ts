import type { Payload } from 'payload'

import type { Order } from '@/payload-types'

/**
 * Everything the rest of the app knows about taking payments. Pages, collections, and the
 * order functions talk to this interface only, so adding Paymob later means one new file
 * and one new line in index.ts, with nothing else changing.
 *
 * `startPayment` takes the Payload instance as a second argument (the original sketch had
 * only the order) because adapters read settings from the database, and importing the
 * config from inside an adapter would create an import cycle.
 */
export interface PaymentProvider {
  id: 'manual' | 'paymob'
  startPayment(
    order: Order,
    ctx: { payload: Payload },
  ): Promise<
    | { kind: 'instructions'; payTo: string; amount: number; reference: string }
    | { kind: 'redirect'; url: string }
  >
  handleWebhook?(req: Request): Promise<{ orderId: string; status: 'paid' | 'failed' }>
}
