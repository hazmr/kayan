import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getStaffOverview } from '@/lib/dashboard/overview'
import { startOrder } from '@/lib/orders/startOrder'
import type { User } from '@/payload-types'

import {
  makeAwaitingReview,
  makeCourse,
  makeUser,
  requestFor,
  setPaymentSettings,
} from '../support/factories'
import { startApp, stopApp } from '../support/payload'

let payload: Payload
let owner: User
let staff: User

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  owner = await makeUser(payload, 'superadmin')
  staff = await makeUser(payload, 'admin', 'staff')
})
afterAll(() => stopApp(payload))

// The dashboard's work queues, and the rule that only students buy. (The money is in
// academyMoney.test.ts.) Other test files share this database, so counts are compared as deltas.

describe('the queues overview (Admin and instructors)', () => {
  it('counts the work waiting and carries no money at all', async () => {
    const doctor = await makeUser(payload, 'admin')
    const course = await makeCourse(payload, doctor)
    const before = await getStaffOverview(staff)
    await makeAwaitingReview(payload, await makeUser(payload, 'student'), course)
    const after = await getStaffOverview(staff)

    expect(after.awaitingReceipts - before.awaitingReceipts).toBe(1)
    // Lists of waiting work and plain counts: no field here carries a money split.
    expect(Object.keys(after).sort()).toEqual([
      'awaitingReceipts',
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

  it('is open to instructors and refused for students', async () => {
    await expect(getStaffOverview(await makeUser(payload, 'admin'))).resolves.toBeTruthy()
    await expect(getStaffOverview(await makeUser(payload, 'student'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})

describe('who can buy', () => {
  it('only a student can: owner, staff, and doctors (even for their own course) are refused', async () => {
    const doctor = await makeUser(payload, 'admin')
    const course = await makeCourse(payload, doctor, { price: 40000 })
    const free = await makeCourse(payload, doctor, { price: 0 })

    for (const buyer of [owner, staff, doctor, await makeUser(payload, 'admin')]) {
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
