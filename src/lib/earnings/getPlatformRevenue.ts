import config from '@payload-config'
import { getPayload } from 'payload'

import { isSuperadmin } from '@/access/roles'
import { relationId } from '@/collections/shared/relationId'
import type { Localized } from '@/lib/dashboard/types'
import { AppError } from '@/lib/errors/AppError'
import type { User } from '@/payload-types'

import {
  summarizeRevenue,
  type CourseRevenue,
  type DoctorRevenue,
  type RevenueSummary,
} from './revenue'

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

export interface PlatformRevenue extends Omit<RevenueSummary, 'perCourse' | 'perDoctor'> {
  perCourse: (CourseRevenue & { title: Localized })[]
  perDoctor: (DoctorRevenue & { name: string })[]
}

/**
 * The owner's whole-platform money overview: what students paid, the platform's share, the
 * doctors' share, what was paid out and what is still owed. Owner only: managers are refused.
 * (Reads orders with full access on the owner's behalf, after checking who is asking.)
 */
export async function getPlatformRevenue(viewer: User, now = new Date()): Promise<PlatformRevenue> {
  if (!isSuperadmin(viewer)) throw new AppError('FORBIDDEN')
  const payload = await getPayload({ config })

  const [orders, payouts] = await Promise.all([
    payload.find({
      collection: 'orders',
      where: { status: { in: ['paid', 'refunded'] } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: {
        course: true,
        owner: true,
        amount: true,
        ownerAmount: true,
        status: true,
        paidAt: true,
      },
    }),
    payload.find({
      collection: 'payouts',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { owner: true, amount: true },
    }),
  ])

  const summary = summarizeRevenue(
    orders.docs.flatMap((order) =>
      (order.status === 'paid' || order.status === 'refunded') && relationId(order.owner)
        ? [
            {
              courseId: relationId(order.course) ?? '',
              doctorId: relationId(order.owner) ?? '',
              amount: order.amount,
              ownerAmount: order.ownerAmount ?? 0,
              status: order.status,
              paidAt: order.paidAt ?? null,
            },
          ]
        : [],
    ),
    payouts.docs.flatMap((payout) => {
      const doctorId = relationId(payout.owner)
      return doctorId ? [{ doctorId, amount: payout.amount }] : []
    }),
    now,
  )

  const courseIds = summary.perCourse.map((course) => course.courseId)
  const doctorIds = summary.perDoctor.map((doctor) => doctor.doctorId)
  const [courses, doctors] = await Promise.all([
    courseIds.length
      ? payload.find({
          collection: 'courses',
          where: { id: { in: courseIds } },
          depth: 0,
          pagination: false,
          locale: 'all',
          overrideAccess: true,
          select: { title: true },
        })
      : { docs: [] },
    doctorIds.length
      ? payload.find({
          collection: 'users',
          where: { id: { in: doctorIds } },
          depth: 0,
          pagination: false,
          overrideAccess: true,
          select: { name: true },
        })
      : { docs: [] },
  ])
  const titles = new Map(courses.docs.map((course) => [course.id, localized(course.title)]))
  const names = new Map(doctors.docs.map((doctor) => [doctor.id, doctor.name]))

  return {
    ...summary,
    perCourse: summary.perCourse.map((course) => ({
      ...course,
      title: titles.get(course.courseId) ?? { ar: '', en: '' },
    })),
    perDoctor: summary.perDoctor.map((doctor) => ({
      ...doctor,
      name: names.get(doctor.doctorId) ?? '',
    })),
  }
}
