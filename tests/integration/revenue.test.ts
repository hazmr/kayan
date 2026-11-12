import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getDoctorOverview, getStaffOverview } from '@/lib/dashboard/overview'
import { getPlatformRevenue } from '@/lib/earnings/getPlatformRevenue'
import { recordPayout } from '@/lib/earnings/payouts'
import { startOrder } from '@/lib/orders/startOrder'
import { refundOrder } from '@/lib/orders/refunds'
import type { User } from '@/payload-types'

import {
  makeAwaitingReview,
  makeCourse,
  makeLesson,
  makePaidOrder,
  makeUser,
  requestFor,
  setPaymentSettings,
} from '../support/factories'
import { startApp, stopApp } from '../support/payload'

let payload: Payload
let owner: User
let manager: User

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  owner = await makeUser(payload, 'superadmin')
  manager = await makeUser(payload, 'manager')
})
afterAll(() => stopApp(payload))

// Other test files share this database, so the platform totals include their sales too. These
// tests therefore look at a fresh doctor's own rows, and at how the totals MOVE.

describe('the owner revenue overview', () => {
  it('splits every sale between the platform and the doctor, per doctor and per course', async () => {
    const before = await getPlatformRevenue(owner)
    const doctor = await makeUser(payload, 'admin')
    const course = await makeCourse(payload, doctor, { price: 40000, sharePercent: 70 })
    await makeLesson(payload, course)
    for (let i = 0; i < 2; i++)
      await makePaidOrder(payload, await makeUser(payload, 'student'), course, manager)

    const after = await getPlatformRevenue(owner)

    expect(after.gross - before.gross).toBe(80000)
    expect(after.doctors - before.doctors).toBe(56000)
    expect(after.platform - before.platform).toBe(24000)
    expect(after.sales - before.sales).toBe(2)
    expect(after.perDoctor.find((row) => row.doctorId === doctor.id)).toMatchObject({
      name: doctor.name,
      sales: 2,
      gross: 80000,
      doctors: 56000,
      platform: 24000,
      paidOut: 0,
      owed: 56000,
    })
    expect(after.perCourse.find((row) => row.courseId === course.id)).toMatchObject({
      sales: 2,
      gross: 80000,
      platform: 24000,
      doctors: 56000,
    })
    // The current month's row grew by the same amount.
    expect(after.months[0]!.gross - before.months[0]!.gross).toBe(80000)
  })

  it('takes refunds out of the totals and payouts out of what is owed', async () => {
    const doctor = await makeUser(payload, 'admin')
    const course = await makeCourse(payload, doctor, { price: 40000, sharePercent: 70 })
    await makeLesson(payload, course)
    const first = await makePaidOrder(payload, await makeUser(payload, 'student'), course, manager)
    await makePaidOrder(payload, await makeUser(payload, 'student'), course, manager)
    await recordPayout({
      doctorId: doctor.id,
      amount: 30000,
      req: await requestFor(payload, owner),
    })

    const before = await getPlatformRevenue(owner)
    await refundOrder(first.id, await requestFor(payload, manager))
    const after = await getPlatformRevenue(owner)

    expect(after.gross - before.gross).toBe(-40000)
    expect(after.refundedCount - before.refundedCount).toBe(1)
    expect(after.refundedAmount - before.refundedAmount).toBe(40000)
    // One sale left (28000 to the doctor), 30000 already paid: the doctor is overpaid by 2000.
    expect(after.perDoctor.find((row) => row.doctorId === doctor.id)).toMatchObject({
      gross: 40000,
      doctors: 28000,
      paidOut: 30000,
      owed: -2000,
    })
  })

  it('ignores orders that are not paid yet', async () => {
    const doctor = await makeUser(payload, 'admin')
    const course = await makeCourse(payload, doctor)
    await makeAwaitingReview(payload, await makeUser(payload, 'student'), course)
    const result = await getPlatformRevenue(owner)
    expect(result.perDoctor.find((row) => row.doctorId === doctor.id)).toBeUndefined()
  })

  it('is refused for managers, doctors, and students', async () => {
    for (const role of ['manager', 'admin', 'student'] as const) {
      await expect(getPlatformRevenue(await makeUser(payload, role))).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    }
  })
})

describe("the manager's overview", () => {
  it('counts the work waiting and carries no money at all', async () => {
    const doctor = await makeUser(payload, 'admin')
    const course = await makeCourse(payload, doctor)
    const before = await getStaffOverview(manager)
    await makeAwaitingReview(payload, await makeUser(payload, 'student'), course)
    const after = await getStaffOverview(manager)

    expect(after.awaitingReceipts - before.awaitingReceipts).toBe(1)
    // Lists of waiting work and plain counts: no field here carries a money split.
    expect(Object.keys(after).sort()).toEqual([
      'awaitingReceipts',
      'courses',
      'coursesInReview',
      'publishedCourses',
      'receipts',
      'refundRequests',
      'refunds',
      'students',
    ])
    expect(after.receipts.length).toBeGreaterThan(0)
    expect(Object.keys(after.receipts[0]!).sort()).toEqual([
      'amountEgp',
      'id',
      'since',
      'title',
      'who',
    ])
  })

  it('is refused for doctors and students', async () => {
    await expect(getStaffOverview(await makeUser(payload, 'admin'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(getStaffOverview(await makeUser(payload, 'student'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})

describe("a doctor's overview", () => {
  it("shows the doctor's own earnings, students, and courses, and nobody else's", async () => {
    const doctor = await makeUser(payload, 'admin')
    const other = await makeUser(payload, 'admin')
    const mine = await makeCourse(payload, doctor, { price: 40000, sharePercent: 70 })
    const draft = await makeCourse(payload, doctor, { status: 'draft' })
    const theirs = await makeCourse(payload, other, { price: 40000 })
    await makeLesson(payload, mine)
    await makePaidOrder(payload, await makeUser(payload, 'student'), mine, manager)
    await makePaidOrder(payload, await makeUser(payload, 'student'), theirs, manager)
    expect(draft.status).toBe('draft')

    const overview = await getDoctorOverview(doctor)
    expect(overview.earnings).toMatchObject({ totalEarned: 28000, balance: 28000 })
    expect(overview.studentsEnrolled).toBe(1)
    expect(overview.courses).toEqual({ draft: 1, in_review: 0, published: 1, archived: 0 })
    expect(overview.recentSales).toHaveLength(1)
  })
})

describe('who can buy', () => {
  it('only a student can: owner, manager, and doctors (even for their own course) are refused', async () => {
    const doctor = await makeUser(payload, 'admin')
    const course = await makeCourse(payload, doctor, { price: 40000 })
    const free = await makeCourse(payload, doctor, { price: 0 })

    for (const buyer of [owner, manager, doctor, await makeUser(payload, 'admin')]) {
      await expect(
        startOrder({
          courseId: course.id,
          method: 'instapay',
          req: await requestFor(payload, buyer),
        }),
      ).rejects.toMatchObject({ code: 'ONLY_STUDENTS_CAN_BUY' })
      await expect(
        startOrder({ courseId: free.id, req: await requestFor(payload, buyer) }),
      ).rejects.toMatchObject({ code: 'ONLY_STUDENTS_CAN_BUY' })
    }

    const student = await makeUser(payload, 'student')
    await expect(
      startOrder({
        courseId: course.id,
        method: 'instapay',
        req: await requestFor(payload, student),
      }),
    ).resolves.toMatchObject({ resumed: false })
  })
})

describe('who can see the share percent', () => {
  it("the owner and the course's own doctor can; managers and other doctors cannot", async () => {
    const doctor = await makeUser(payload, 'admin')
    const other = await makeUser(payload, 'admin')
    const course = await makeCourse(payload, doctor, { sharePercent: 65 })

    const seenBy = async (user: User) =>
      (
        await payload.findByID({
          collection: 'courses',
          id: course.id,
          user,
          overrideAccess: false,
        })
      ).ownerSharePercent

    expect(await seenBy(owner)).toBe(65)
    expect(await seenBy(doctor)).toBe(65)
    expect(await seenBy(manager)).toBeUndefined()
    expect(await seenBy(other)).toBeUndefined()
  })
})
