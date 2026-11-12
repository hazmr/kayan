import config from '@payload-config'
import { getPayload } from 'payload'

import { isStaff } from '@/access/roles'
import { relationId } from '@/collections/shared/relationId'
import type { Localized } from '@/lib/dashboard/types'
import { AppError } from '@/lib/errors/AppError'
import type { User } from '@/payload-types'

import { groupBalances, summarizeEarnings, type CourseEarnings } from './calculate'

function localized(value: unknown): Localized {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >
  return {
    ar: typeof record.ar === 'string' ? record.ar : '',
    en: typeof record.en === 'string' ? record.en : '',
  }
}

export interface PayoutRow {
  id: string
  amount: number
  paidAt: string
  note: string
  recordedBy: string
}

export interface OwnerEarnings {
  doctor: { id: string; name: string; email: string }
  perCourse: (CourseEarnings & { title: Localized })[]
  totalEarned: number
  totalPaidOut: number
  /** Piasters. Negative when a refund came after a payout. */
  balance: number
  payouts: PayoutRow[]
}

/**
 * One doctor's earnings page. A doctor may load only their own; staff may load anyone's.
 * (Orders are not readable by doctors through the API, so this reads them on their behalf
 * after checking who is asking.)
 */
export async function getOwnerEarnings(viewer: User, doctorId: string): Promise<OwnerEarnings> {
  if (!isStaff(viewer) && viewer.id !== doctorId) throw new AppError('NOT_FOUND')

  const payload = await getPayload({ config })
  const doctor = await payload
    .findByID({ collection: 'users', id: doctorId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doctor || doctor.role !== 'admin') throw new AppError('NOT_FOUND')

  const [orders, payouts] = await Promise.all([
    payload.find({
      collection: 'orders',
      where: {
        and: [{ owner: { equals: doctorId } }, { status: { in: ['paid', 'refunded'] } }],
      },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { course: true, ownerAmount: true, status: true },
    }),
    payload.find({
      collection: 'payouts',
      where: { owner: { equals: doctorId } },
      depth: 1,
      pagination: false,
      sort: '-paidAt',
      overrideAccess: true,
    }),
  ])

  const summary = summarizeEarnings(
    orders.docs.flatMap((order) =>
      order.status === 'paid' || order.status === 'refunded'
        ? [
            {
              courseId: relationId(order.course) ?? '',
              ownerAmount: order.ownerAmount ?? 0,
              status: order.status,
            },
          ]
        : [],
    ),
    payouts.docs,
  )

  const courseIds = summary.perCourse.map((course) => course.courseId)
  const courses = courseIds.length
    ? await payload.find({
        collection: 'courses',
        where: { id: { in: courseIds } },
        depth: 0,
        pagination: false,
        locale: 'all',
        overrideAccess: true,
        select: { title: true },
      })
    : { docs: [] }
  const titles = new Map(courses.docs.map((course) => [course.id, localized(course.title)]))

  return {
    doctor: { id: doctor.id, name: doctor.name, email: doctor.email },
    perCourse: summary.perCourse.map((course) => ({
      ...course,
      title: titles.get(course.courseId) ?? { ar: '', en: '' },
    })),
    totalEarned: summary.totalEarned,
    totalPaidOut: summary.totalPaidOut,
    balance: summary.balance,
    payouts: payouts.docs.map((payout) => ({
      id: payout.id,
      amount: payout.amount,
      paidAt: payout.paidAt,
      note: payout.note ?? '',
      recordedBy: typeof payout.paidBy === 'object' ? payout.paidBy.name : '',
    })),
  }
}

export interface DoctorBalanceRow {
  id: string
  name: string
  email: string
  earned: number
  paidOut: number
  balance: number
}

/** The owner's and managers' overview: every doctor and what they are owed. Staff only. */
export async function listDoctorBalances(viewer: User): Promise<DoctorBalanceRow[]> {
  if (!isStaff(viewer)) throw new AppError('FORBIDDEN')
  const payload = await getPayload({ config })

  const [doctors, orders, payouts] = await Promise.all([
    payload.find({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      depth: 0,
      pagination: false,
      sort: 'name',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'orders',
      where: { status: { equals: 'paid' } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { owner: true, ownerAmount: true },
    }),
    payload.find({
      collection: 'payouts',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { owner: true, amount: true },
    }),
  ])

  const balances = groupBalances(
    orders.docs.flatMap((order) => {
      const doctorId = relationId(order.owner)
      return doctorId ? [{ doctorId, ownerAmount: order.ownerAmount ?? 0 }] : []
    }),
    payouts.docs.flatMap((payout) => {
      const doctorId = relationId(payout.owner)
      return doctorId ? [{ doctorId, amount: payout.amount }] : []
    }),
  )

  return doctors.docs
    .map((doctor) => {
      const found = balances.get(doctor.id)
      return {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        earned: found?.earned ?? 0,
        paidOut: found?.paidOut ?? 0,
        balance: found?.balance ?? 0,
      }
    })
    .sort((a, b) => b.balance - a.balance)
}
