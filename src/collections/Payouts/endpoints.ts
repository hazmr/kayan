import type { Endpoint, PayloadRequest } from 'payload'

import { AppError } from '@/lib/errors/AppError'
import { deletePayout, recordPayout } from '@/lib/earnings/payouts'

// Thin wrappers: read the input, call ONE function, answer. The rules live in src/lib/earnings.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function jsonBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  const body: unknown = await req.json?.().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

export const payoutEndpoints: Endpoint[] = [
  // { doctorId, amount (whole piasters), paidAt?, note? }
  {
    path: '/record',
    method: 'post',
    handler: async (req) => {
      const body = await jsonBody(req)
      const doctorId = typeof body.doctorId === 'string' ? body.doctorId : ''
      if (!UUID.test(doctorId)) throw new AppError('NOT_FOUND')
      const payout = await recordPayout({
        doctorId,
        // Anything that is not a whole number becomes NaN, which recordPayout refuses.
        amount: typeof body.amount === 'number' ? body.amount : Number.NaN,
        paidAt: typeof body.paidAt === 'string' ? body.paidAt : undefined,
        note: typeof body.note === 'string' ? body.note : undefined,
        req,
      })
      return Response.json({ id: payout.id, amount: payout.amount })
    },
  },
  // { password }
  {
    path: '/:id/delete',
    method: 'post',
    handler: async (req) => {
      const id = req.routeParams?.id
      if (typeof id !== 'string' || !UUID.test(id)) throw new AppError('NOT_FOUND')
      const body = await jsonBody(req)
      await deletePayout(id, typeof body.password === 'string' ? body.password : '', req)
      return Response.json({ id })
    },
  },
]
