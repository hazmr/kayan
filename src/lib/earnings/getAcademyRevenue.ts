import config from '@payload-config'
import { getPayload } from 'payload'

import { isStaff } from '@/access/roles'
import { relationId } from '@/collections/shared/relationId'
import { DEFAULT_ADMIN_SHARE_PERCENT } from '@/globals/PlatformSettings'
import type { Localized } from '@/lib/dashboard/types'
import { AppError } from '@/lib/errors/AppError'
import type { User } from '@/payload-types'

import { summarizeRevenue, type CourseRevenue, type RevenueSummary } from './revenue'

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

export interface AdminPaymentRow {
  id: string
  amount: number
  paidAt: string
  note: string
  recordedBy: string
}

export interface AcademyRevenue extends Omit<RevenueSummary, 'perCourse'> {
  /** Today's percent: applies to sales from now on. */
  adminSharePercent: number
  perCourse: (CourseRevenue & { title: Localized })[]
  payments: AdminPaymentRow[]
}

/**
 * The academy's whole money picture, the same for the Admin and every instructor: what students
 * paid, the Admin's share and the academy's share, what was paid to the Admin and what is still
 * owed, by month and by course. Students and guests are refused.
 */
export async function getAcademyRevenue(viewer: User, now = new Date()): Promise<AcademyRevenue> {
  if (!isStaff(viewer)) throw new AppError('FORBIDDEN')
  const payload = await getPayload({ config })

  const [orders, payments, settings] = await Promise.all([
    payload.find({
      collection: 'orders',
      where: { status: { in: ['paid', 'refunded'] } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { course: true, amount: true, adminAmount: true, status: true, paidAt: true },
    }),
    payload.find({
      collection: 'admin-payments',
      depth: 1,
      pagination: false,
      sort: '-paidAt',
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'platform-settings', overrideAccess: true }),
  ])

  const summary = summarizeRevenue(
    orders.docs.flatMap((order) =>
      order.status === 'paid' || order.status === 'refunded'
        ? [
            {
              courseId: relationId(order.course) ?? '',
              amount: order.amount,
              adminAmount: order.adminAmount ?? 0,
              status: order.status,
              paidAt: order.paidAt ?? null,
            },
          ]
        : [],
    ),
    payments.docs,
    now,
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
    ...summary,
    adminSharePercent: settings.adminSharePercent ?? DEFAULT_ADMIN_SHARE_PERCENT,
    perCourse: summary.perCourse.map((course) => ({
      ...course,
      title: titles.get(course.courseId) ?? { ar: '', en: '' },
    })),
    payments: payments.docs.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      paidAt: payment.paidAt,
      note: payment.note ?? '',
      recordedBy: typeof payment.recordedBy === 'object' ? payment.recordedBy.name : '',
    })),
  }
}
