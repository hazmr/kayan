import type { PayloadRequest } from 'payload'

import { isSuperadmin } from '@/access/roles'
import { passwordMatches } from '@/lib/auth/verifyPassword'
import { requireUser } from '@/lib/auth/requireActor'
import { withTransaction } from '@/lib/db/withTransaction'
import { sendPayoutRecordedEmail, sendPayoutRemovedEmail } from '@/lib/email/payoutEmails'
import { AppError } from '@/lib/errors/AppError'
import type { Payout, User } from '@/payload-types'

import { getOwnerEarnings } from './getOwnerEarnings'

/** EGP 10,000,000 in piasters. A typo like an extra zero is caught rather than recorded. */
export const MAX_PAYOUT_PIASTERS = 1_000_000_000

function requireOwner(req: PayloadRequest): User {
  const user = requireUser(req)
  if (!isSuperadmin(user)) throw new AppError('FORBIDDEN')
  return user
}

async function loadDoctor(doctorId: string, req: PayloadRequest): Promise<User> {
  const doctor = await req.payload
    .findByID({ collection: 'users', id: doctorId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  // Only a doctor account can be paid. Anything else looks like a missing record.
  if (!doctor || doctor.role !== 'admin') throw new AppError('NOT_FOUND')
  return doctor
}

interface RecordPayoutArgs {
  doctorId: string
  /** Whole piasters. */
  amount: number
  /** The day the money was sent. Defaults to now. */
  paidAt?: string
  note?: string
  req: PayloadRequest
}

/**
 * The owner writes down that they sent money to a doctor. Nothing is moved: the balance simply
 * goes down by the amount, and the doctor is told by email.
 */
export async function recordPayout({
  doctorId,
  amount,
  paidAt,
  note,
  req,
}: RecordPayoutArgs): Promise<Payout> {
  const owner = requireOwner(req)

  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_PAYOUT_PIASTERS) {
    throw new AppError('VALIDATION_FAILED')
  }
  const sentOn = paidAt ? new Date(paidAt) : new Date()
  const oneDayAhead = Date.now() + 24 * 60 * 60 * 1000 // a little slack for time zones
  if (Number.isNaN(sentOn.getTime()) || sentOn.getTime() > oneDayAhead) {
    throw new AppError('VALIDATION_FAILED')
  }
  const text = note?.trim() ?? ''
  if (text.length > 500) throw new AppError('VALIDATION_FAILED')

  const doctor = await loadDoctor(doctorId, req)
  const payout = await withTransaction(req, () =>
    req.payload.create({
      collection: 'payouts',
      data: {
        owner: doctor.id,
        amount,
        paidAt: sentOn.toISOString(),
        paidBy: owner.id,
        note: text,
      },
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )

  const earnings = await getOwnerEarnings(owner, doctor.id)
  await sendPayoutRecordedEmail({
    payload: req.payload,
    doctor,
    amount,
    paidAt: sentOn,
    note: text,
    balance: earnings.balance,
  })
  return payout
}

/**
 * Removes a payout record, to correct a mistake (record the right one afterwards). A financial
 * record disappearing is serious, so it needs the owner's password and the doctor is emailed.
 */
export async function deletePayout(
  payoutId: string,
  password: string,
  req: PayloadRequest,
): Promise<void> {
  const owner = requireOwner(req)
  if (!password || !(await passwordMatches(owner.email, password, req))) {
    throw new AppError('WRONG_PASSWORD')
  }

  const payout = await req.payload
    .findByID({ collection: 'payouts', id: payoutId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!payout) throw new AppError('NOT_FOUND')
  const doctor = await loadDoctor(
    typeof payout.owner === 'string' ? payout.owner : payout.owner.id,
    req,
  )

  await withTransaction(req, () =>
    req.payload.delete({ collection: 'payouts', id: payout.id, overrideAccess: true, req }),
  )

  const earnings = await getOwnerEarnings(owner, doctor.id)
  await sendPayoutRemovedEmail({
    payload: req.payload,
    doctor,
    amount: payout.amount,
    paidAt: new Date(payout.paidAt),
    note: payout.note ?? '',
    balance: earnings.balance,
  })
}
