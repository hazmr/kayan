import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { deleteAdminPayment, recordAdminPayment } from '@/lib/earnings/adminPayments'
import { getAcademyRevenue } from '@/lib/earnings/getAcademyRevenue'
import { refundOrder } from '@/lib/orders/refunds'
import type { Course, User } from '@/payload-types'

import {
  makeCourse,
  makeLesson,
  makePaidOrder,
  makeUser,
  PASSWORD,
  requestFor,
  setAdminSharePercent,
  setPaymentSettings,
} from '../support/factories'
import { emails, startApp, stopApp } from '../support/payload'

// The academy's money: the Admin earns a percent of each sale (frozen on the order when the student
// pays), the academy keeps the rest, and the academy's payments to the Admin are recorded.
// Other test files share this database, so the tests look at how the totals MOVE.

let payload: Payload
let admin: User
let instructor: User
let course: Course

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  await setAdminSharePercent(payload, 30)
  admin = await makeUser(payload, 'superadmin')
  instructor = await makeUser(payload, 'admin')
  course = await makeCourse(payload, instructor, { price: 40000 })
  await makeLesson(payload, course)
})
afterAll(() => stopApp(payload))
beforeEach(() => emails.reset())

const revenue = () => getAcademyRevenue(admin)
const sell = async (target = course) =>
  makePaidOrder(payload, await makeUser(payload, 'student'), target, instructor)
const pay = async (
  amount: number,
  by = instructor,
  extra: { note?: string; paidAt?: string } = {},
) => recordAdminPayment({ amount, req: await requestFor(payload, by), ...extra })

describe("the Admin's share of each sale", () => {
  it('splits a sale between the academy and the Admin at the current percent', async () => {
    const before = await revenue()
    await sell()
    const after = await revenue()
    expect(after.gross - before.gross).toBe(40000)
    expect(after.admin - before.admin).toBe(12000) // 30%
    expect(after.academy - before.academy).toBe(28000)
    expect(after.owedToAdmin - before.owedToAdmin).toBe(12000)
    expect(after.adminSharePercent).toBe(30)
  })

  it('a new percent applies to new sales only; earlier sales keep the percent they were sold at', async () => {
    const before = await revenue()
    await sell() // at 30%
    await setAdminSharePercent(payload, 10)
    await sell() // at 10%
    await setAdminSharePercent(payload, 30)
    const after = await revenue()
    expect(after.admin - before.admin).toBe(12000 + 4000)
  })

  it("a refund takes the sale out of the totals, the Admin's share included", async () => {
    const order = await sell()
    const before = await revenue()
    await refundOrder(order.id, await requestFor(payload, instructor))
    const after = await revenue()
    expect(after.gross - before.gross).toBe(-40000)
    expect(after.admin - before.admin).toBe(-12000)
    expect(after.refundedCount - before.refundedCount).toBe(1)
  })

  it('shows the course in the per-course table', async () => {
    const own = await makeCourse(payload, instructor, { price: 20000 })
    await makeLesson(payload, own)
    await sell(own)
    const row = (await revenue()).perCourse.find((item) => item.courseId === own.id)
    expect(row).toMatchObject({ sales: 1, gross: 20000, admin: 6000, academy: 14000 })
  })

  it('is the same picture for the Admin and every instructor, and refused for students and guests', async () => {
    const asAdmin = await getAcademyRevenue(admin)
    const asInstructor = await getAcademyRevenue(await makeUser(payload, 'admin'))
    expect(asInstructor.gross).toBe(asAdmin.gross)
    expect(asInstructor.owedToAdmin).toBe(asAdmin.owedToAdmin)
    await expect(getAcademyRevenue(await makeUser(payload, 'student'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})

describe('recording a payment to the Admin', () => {
  it('can be done by an instructor or the Admin, and lowers what is owed', async () => {
    await sell()
    const before = await revenue()
    await pay(5000, instructor, { note: 'transfer 123' })
    await pay(1000, admin)
    const after = await revenue()
    expect(after.paidToAdmin - before.paidToAdmin).toBe(6000)
    expect(after.owedToAdmin - before.owedToAdmin).toBe(-6000)
    expect(after.payments[0]).toMatchObject({ amount: 1000, recordedBy: admin.name })
  })

  it('emails the Admin and every instructor, with the amount, the note, and what is still owed', async () => {
    await pay(2500, instructor, { note: 'march share' })
    for (const person of [admin, instructor]) {
      const mail = emails
        .to(person.email)
        .filter((email) => email.subject.includes('Payment recorded'))
      expect(mail, person.email).toHaveLength(1)
      expect(mail[0]?.html).toContain('EGP 25')
      expect(mail[0]?.html).toContain('march share')
      expect(mail[0]?.html).toContain('Still owed to the Admin')
    }
  })

  it('allows paying more than is owed: what is owed simply goes negative', async () => {
    const before = await revenue()
    await pay(before.owedToAdmin + 100_00)
    expect((await revenue()).owedToAdmin).toBe(-100_00)
    await pay(1, admin) // keep the numbers moving for the next test
  })

  it.each([
    ['zero', 0],
    ['a negative amount', -100],
    ['a fraction of a piaster', 1.5],
    ['not a number', Number.NaN],
    ['more than EGP 10,000,000', 1_000_000_001],
  ])('refuses %s', async (_name, amount) => {
    await expect(pay(amount)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('refuses a bad date, a date more than a day ahead, and a note over 500 characters', async () => {
    await expect(pay(100, instructor, { paidAt: 'yesterday' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await expect(pay(100, instructor, { paidAt: nextWeek })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    await expect(pay(100, instructor, { note: 'x'.repeat(501) })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('is refused for a student and a guest', async () => {
    await expect(pay(100, await makeUser(payload, 'student'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      recordAdminPayment({ amount: 100, req: await requestFor(payload, null) }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('records every one of several payments made at the same instant', async () => {
    const before = await revenue()
    await Promise.all([pay(100), pay(200), pay(300)])
    expect((await revenue()).paidToAdmin - before.paidToAdmin).toBe(600)
  })
})

describe('deleting a payment record (to correct a mistake)', () => {
  it("needs the Admin's password; then it is gone, what is owed goes back up, and everyone is told", async () => {
    const payment = await pay(7000)
    const before = await revenue()
    emails.reset()
    await expect(
      deleteAdminPayment(payment.id, 'wrong', await requestFor(payload, admin)),
    ).rejects.toMatchObject({ code: 'WRONG_PASSWORD' })
    await deleteAdminPayment(payment.id, PASSWORD, await requestFor(payload, admin))
    const after = await revenue()
    expect(after.paidToAdmin - before.paidToAdmin).toBe(-7000)
    expect(after.payments.some((item) => item.id === payment.id)).toBe(false)
    expect(emails.withSubject('Payment record removed').map((email) => email.to)).toEqual(
      expect.arrayContaining([admin.email, instructor.email]),
    )
  })

  it('is the Admin only: an instructor who recorded it cannot remove it', async () => {
    const payment = await pay(100)
    await expect(
      deleteAdminPayment(payment.id, PASSWORD, await requestFor(payload, instructor)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      deleteAdminPayment(payment.id, PASSWORD, await requestFor(payload, null)),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})

describe('the payment details', () => {
  it('can be changed by an instructor, and every change is emailed to the Admin and the instructors', async () => {
    await payload.updateGlobal({
      slug: 'payment-settings',
      data: { instapayAddress: 'changed@instapay' },
      user: instructor,
      overrideAccess: false,
    })
    const mail = emails.withSubject('Payment details changed')
    expect(mail.map((email) => email.to)).toEqual(
      expect.arrayContaining([admin.email, instructor.email]),
    )
    expect(mail[0]?.html).toContain('changed@instapay')
    await setPaymentSettings(payload)
  })

  it('cannot be changed by a student', async () => {
    await expect(
      payload.updateGlobal({
        slug: 'payment-settings',
        data: { instapayAddress: 'thief@instapay' },
        user: await makeUser(payload, 'student'),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
