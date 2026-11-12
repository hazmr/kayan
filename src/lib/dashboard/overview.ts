import config from '@payload-config'
import { getPayload } from 'payload'

import { isStaff } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'
import type { User } from '@/payload-types'

import {
  countAwaitingReview,
  countRefundRequests,
  listAwaitingReview,
  listRefundRequests,
} from './paymentQueries'
import type { Localized } from './types'

// What each role sees first on the dashboard. These read only what the role may know:
// the manager's version has no money in it at all.

/** One thing waiting for a decision, in the short form the overview lists show. */
export interface WorkItem {
  id: string
  /** The student. */
  who: string
  title: Localized
  /** What the student paid, to match it to the transfer. */
  amountEgp?: number
  /** When it started waiting (ISO date). */
  since: string
}

export interface StaffOverview {
  awaitingReceipts: number
  refundRequests: number
  publishedCourses: number
  students: number
  /** The oldest few of each, so the manager can open the first one straight away. */
  receipts: WorkItem[]
  refunds: WorkItem[]
}

const SHOWN = 5

/** Work waiting for the owner or a manager, the oldest items first, and two plain counts. No money split. */
export async function getStaffOverview(user: User): Promise<StaffOverview> {
  if (!isStaff(user)) throw new AppError('FORBIDDEN')
  const payload = await getPayload({ config })
  const [counts, receipts, refunds, published, students] = await Promise.all([
    Promise.all([countAwaitingReview(user), countRefundRequests(user)]),
    listAwaitingReview(user),
    listRefundRequests(user),
    payload.count({
      collection: 'courses',
      where: { status: { equals: 'published' } },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'users',
      where: { role: { equals: 'student' } },
      overrideAccess: true,
    }),
  ])
  return {
    awaitingReceipts: counts[0],
    refundRequests: counts[1],
    publishedCourses: published.totalDocs,
    students: students.totalDocs,
    receipts: receipts.slice(0, SHOWN).map((item) => ({
      id: item.id,
      who: item.student.name,
      title: item.courseTitle,
      amountEgp: item.amountEgp,
      since: item.createdAt,
    })),
    refunds: refunds.slice(0, SHOWN).map((item) => ({
      id: item.id,
      who: item.student.name,
      title: item.courseTitle,
      amountEgp: item.amountEgp,
      since: item.refund?.requestedAt ?? item.createdAt,
    })),
  }
}
