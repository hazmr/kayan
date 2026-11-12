import type { Endpoint, PayloadRequest } from 'payload'

import { deleteAdminPayment, recordAdminPayment } from '@/lib/earnings/adminPayments'
import { AppError } from '@/lib/errors/AppError'

// Thin wrappers: read the input, call ONE function, answer. The rules live in src/lib/earnings.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function jsonBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  const body: unknown = await req.json?.().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

export const adminPaymentEndpoints: Endpoint[] = [
  // POST /api/admin-payments/record  { amount (whole piasters), paidAt?, note? }
  {
    path: '/record',
    method: 'post',
    handler: async (req) => {
      const body = await jsonBody(req)
      const payment = await recordAdminPayment({
        // Anything that is not a whole number becomes NaN, which recordAdminPayment refuses.
        amount: typeof body.amount === 'number' ? body.amount : Number.NaN,
        paidAt: typeof body.paidAt === 'string' ? body.paidAt : undefined,
        note: typeof body.note === 'string' ? body.note : undefined,
        req,
      })
      return Response.json({ id: payment.id, amount: payment.amount })
    },
  },
  // POST /api/admin-payments/:id/delete  { password }
  {
    path: '/:id/delete',
    method: 'post',
    handler: async (req) => {
      const id = req.routeParams?.id
      if (typeof id !== 'string' || !UUID.test(id)) throw new AppError('NOT_FOUND')
      const body = await jsonBody(req)
      await deleteAdminPayment(id, typeof body.password === 'string' ? body.password : '', req)
      return Response.json({ id })
    },
  },
]
