import type { PayloadRequest } from 'payload'

import { isStaff, isSuperadmin } from '@/access/roles'
import { passwordMatches } from '@/lib/auth/verifyPassword'
import { requireUser } from '@/lib/auth/requireActor'
import { withTransaction } from '@/lib/db/withTransaction'
import { sendAdminPaymentEmail } from '@/lib/email/adminPaymentEmails'
import { AppError } from '@/lib/errors/AppError'
import type { AdminPayment } from '@/payload-types'

import { getAcademyRevenue } from './getAcademyRevenue'

/** EGP 10,000,000 in piasters. A typo like an extra zero is caught rather than recorded. */
export const MAX_PAYMENT_PIASTERS = 1_000_000_000

interface RecordArgs {
  /** Whole piasters. */
  amount: number
  /** The day the money was sent. Defaults to now. */
  paidAt?: string
  note?: string
  req: PayloadRequest
}

/**
 * Writes down that the academy paid the Admin. The Admin or any instructor may record it (either
 * side may be the one who sent or received the transfer). Nothing is moved: the amount owed
 * simply goes down, and everyone is emailed so nobody is surprised.
 */
export async function recordAdminPayment({
  amount,
  paidAt,
  note,
  req,
}: RecordArgs): Promise<AdminPayment> {
  const user = requireUser(req)
  if (!isStaff(user)) throw new AppError('FORBIDDEN')

  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_PAYMENT_PIASTERS) {
    throw new AppError('VALIDATION_FAILED')
  }
  const sentOn = paidAt ? new Date(paidAt) : new Date()
  const oneDayAhead = Date.now() + 24 * 60 * 60 * 1000 // a little slack for time zones
  if (Number.isNaN(sentOn.getTime()) || sentOn.getTime() > oneDayAhead) {
    throw new AppError('VALIDATION_FAILED')
  }
  const text = note?.trim() ?? ''
  if (text.length > 500) throw new AppError('VALIDATION_FAILED')

  const payment = await withTransaction(req, () =>
    req.payload.create({
      collection: 'admin-payments',
      data: { amount, paidAt: sentOn.toISOString(), recordedBy: user.id, note: text },
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )

  const revenue = await getAcademyRevenue(user)
  await sendAdminPaymentEmail(req, {
    kind: 'recorded',
    amount,
    paidAt: sentOn,
    note: text,
    by: user.name,
    owed: revenue.owedToAdmin,
  })
  return payment
}

/**
 * Removes a payment record, to correct a mistake (record the right one afterwards). A financial
 * record disappearing is serious, so only the Admin can do it, with their password, and
 * everyone is emailed.
 */
export async function deleteAdminPayment(
  paymentId: string,
  password: string,
  req: PayloadRequest,
): Promise<void> {
  const user = requireUser(req)
  if (!isSuperadmin(user)) throw new AppError('FORBIDDEN')
  if (!password || !(await passwordMatches(user.email, password, req))) {
    throw new AppError('WRONG_PASSWORD')
  }

  const payment = await req.payload
    .findByID({ collection: 'admin-payments', id: paymentId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!payment) throw new AppError('NOT_FOUND')

  await withTransaction(req, () =>
    req.payload.delete({ collection: 'admin-payments', id: payment.id, overrideAccess: true, req }),
  )

  const revenue = await getAcademyRevenue(user)
  await sendAdminPaymentEmail(req, {
    kind: 'removed',
    amount: payment.amount,
    paidAt: new Date(payment.paidAt),
    note: payment.note ?? '',
    by: user.name,
    owed: revenue.owedToAdmin,
  })
}
