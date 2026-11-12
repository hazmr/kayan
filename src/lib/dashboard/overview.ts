import config from '@payload-config'
import { getPayload } from 'payload'

import { isStaff } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'
import { getOwnerEarnings, type OwnerEarnings } from '@/lib/earnings/getOwnerEarnings'
import type { CourseStatus } from '@/lib/courses/transitions'
import type { User } from '@/payload-types'

import { listSalesForDoctor, type SaleRow } from './orderQueries'
import {
  countAwaitingReview,
  countRefundRequests,
  listAwaitingReview,
  listRefundRequests,
} from './paymentQueries'
import { countCoursesInReview, listCourses } from './queries'
import type { Localized } from './types'

// What each role sees first on the dashboard. These read only what the role may know:
// the manager's version has no money in it at all.

/** One thing waiting for a decision, in the short form the overview lists show. No money split. */
export interface WorkItem {
  id: string
  /** The student (receipts, refunds) or the doctor (courses). */
  who: string
  title: Localized
  /** What the student paid. Receipts and refunds only: a manager needs it to match the transfer. */
  amountEgp?: number
  /** When it started waiting (ISO date). */
  since: string
}

export interface StaffOverview {
  awaitingReceipts: number
  refundRequests: number
  coursesInReview: number
  publishedCourses: number
  students: number
  /** The oldest few of each, so the manager can open the first one straight away. */
  receipts: WorkItem[]
  refunds: WorkItem[]
  courses: WorkItem[]
}

const SHOWN = 5

/** Work waiting for the owner or a manager, the oldest items first, and two plain counts. No money split. */
export async function getStaffOverview(user: User): Promise<StaffOverview> {
  if (!isStaff(user)) throw new AppError('FORBIDDEN')
  const payload = await getPayload({ config })
  const [counts, receipts, refunds, courses, published, students] = await Promise.all([
    Promise.all([countAwaitingReview(user), countRefundRequests(user), countCoursesInReview(user)]),
    listAwaitingReview(user),
    listRefundRequests(user),
    listCourses(user, 'in_review'),
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
    coursesInReview: counts[2],
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
    // Oldest first, like the other two lists (the course list comes newest first).
    courses: [...courses]
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, SHOWN)
      .map((course) => ({
        id: course.id,
        who: course.ownerName,
        title: course.title,
        since: course.updatedAt,
      })),
  }
}

export interface DoctorOverview {
  earnings: OwnerEarnings
  /** Paid orders on this doctor's courses: how many students bought. */
  studentsEnrolled: number
  courses: Record<CourseStatus, number>
  recentSales: SaleRow[]
}

/** A doctor's own numbers: what they earned, how many students, their courses, the latest sales. */
export async function getDoctorOverview(user: User): Promise<DoctorOverview> {
  const payload = await getPayload({ config })
  const [earnings, courses, sales] = await Promise.all([
    getOwnerEarnings(user, user.id),
    payload.find({
      collection: 'courses',
      where: { owner: { equals: user.id } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { status: true },
    }),
    listSalesForDoctor(user, { page: 1 }),
  ])

  const counts: Record<CourseStatus, number> = { draft: 0, in_review: 0, published: 0, archived: 0 }
  for (const course of courses.docs) counts[course.status] += 1

  return {
    earnings,
    studentsEnrolled: earnings.perCourse.reduce((sum, course) => sum + course.paidOrders, 0),
    courses: counts,
    recentSales: sales.rows.slice(0, 5),
  }
}
