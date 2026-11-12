import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getOwnerEarnings, listDoctorBalances } from '@/lib/earnings/getOwnerEarnings'
import { deletePayout, recordPayout } from '@/lib/earnings/payouts'
import { refundOrder } from '@/lib/orders/refunds'
import type { Course, Order, User } from '@/payload-types'

import {
  makeCourse,
  makeLesson,
  makePaidOrder,
  makeUser,
  PASSWORD,
  requestFor,
  setPaymentSettings,
} from '../support/factories'
import { emails, startApp, stopApp } from '../support/payload'

let payload: Payload
let owner: User
let manager: User
let doctor: User
let course: Course
let orders: Order[]

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  owner = await makeUser(payload, 'superadmin')
  manager = await makeUser(payload, 'manager')
})
afterAll(() => stopApp(payload))

// A fresh doctor with known sales, so every number below can be worked out by hand:
// the course costs EGP 400 (40000 piasters) and the doctor keeps 70%, i.e. 28000 per sale.
beforeEach(async () => {
  emails.reset()
  doctor = await makeUser(payload, 'admin')
  course = await makeCourse(payload, doctor, { price: 40000, sharePercent: 70 })
  await makeLesson(payload, course)
  orders = []
  for (let i = 0; i < 3; i++)
    orders.push(await makePaidOrder(payload, await makeUser(payload, 'student'), course, manager))
})

const earnings = async () => getOwnerEarnings(owner, doctor.id)
const pay = async (amount: number, extra: { note?: string; paidAt?: string } = {}) =>
  recordPayout({ doctorId: doctor.id, amount, req: await requestFor(payload, owner), ...extra })

describe('earnings', () => {
  it("adds up the doctor's share of every paid order", async () => {
    const result = await earnings()
    expect(result).toMatchObject({ totalEarned: 84000, totalPaidOut: 0, balance: 84000 })
    expect(result.perCourse).toEqual([
      expect.objectContaining({
        courseId: course.id,
        paidOrders: 3,
        refundedOrders: 0,
        earned: 84000,
      }),
    ])
  })

  it('stops counting an order once it is refunded', async () => {
    await refundOrder(orders[0]!.id, await requestFor(payload, manager))
    const result = await earnings()
    expect(result).toMatchObject({ totalEarned: 56000, balance: 56000 })
    expect(result.perCourse[0]).toMatchObject({ paidOrders: 2, refundedOrders: 1, earned: 56000 })
  })

  it('goes negative when a refund comes after a payout, and a new sale covers it', async () => {
    await pay(84000) // paid for all three sales
    expect((await earnings()).balance).toBe(0)

    await refundOrder(orders[0]!.id, await requestFor(payload, manager))
    expect((await earnings()).balance).toBe(-28000)

    await makePaidOrder(payload, await makeUser(payload, 'student'), course, manager)
    expect((await earnings()).balance).toBe(0)
  })

  it('belongs to the doctor locked in on each order: moving the course keeps past earnings', async () => {
    const successor = await makeUser(payload, 'admin')
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { owner: successor.id },
      overrideAccess: true,
    })
    await makePaidOrder(payload, await makeUser(payload, 'student'), course, manager)

    expect((await earnings()).totalEarned).toBe(84000) // the original doctor keeps the three sales
    expect((await getOwnerEarnings(owner, successor.id)).totalEarned).toBe(28000) // the new one earns only the new sale
  })

  it('is zero for a doctor with no sales', async () => {
    const newcomer = await makeUser(payload, 'admin')
    expect(await getOwnerEarnings(owner, newcomer.id)).toMatchObject({
      totalEarned: 0,
      totalPaidOut: 0,
      balance: 0,
      perCourse: [],
      payouts: [],
    })
  })

  it('is read from the database: it matches the sum of the paid orders', async () => {
    const { docs } = await payload.find({
      collection: 'orders',
      where: { and: [{ owner: { equals: doctor.id } }, { status: { equals: 'paid' } }] },
      pagination: false,
      overrideAccess: true,
    })
    expect((await earnings()).totalEarned).toBe(
      docs.reduce((sum, order) => sum + (order.ownerAmount ?? 0), 0),
    )
  })
})

describe('recording a payout (the owner wrote down money they sent by hand)', () => {
  it('stores it with the owner who recorded it and lowers the balance', async () => {
    const payout = await pay(30000, { note: 'transfer 123', paidAt: '2026-11-01' })
    expect(payout).toMatchObject({
      amount: 30000,
      owner: doctor.id,
      paidBy: owner.id,
      note: 'transfer 123',
    })
    expect(new Date(payout.paidAt).toISOString().slice(0, 10)).toBe('2026-11-01')

    const result = await earnings()
    expect(result.totalPaidOut).toBe(30000)
    expect(result.balance).toBe(54000)
    expect(result.payouts).toEqual([
      expect.objectContaining({ amount: 30000, note: 'transfer 123', recordedBy: owner.name }),
    ])
  })

  it('emails the doctor with the amount, the note, and the new balance', async () => {
    await pay(30000, { note: 'transfer 123' })
    const mail = emails.to(doctor.email)
    expect(mail).toHaveLength(1)
    expect(mail[0]?.subject).toContain('Payout recorded')
    expect(mail[0]?.html).toContain('EGP 300')
    expect(mail[0]?.html).toContain('transfer 123')
    expect(mail[0]?.html).toContain('EGP 540') // 84000 - 30000 = 54000 piasters
  })

  it('allows an over-payment: the balance simply goes negative', async () => {
    await pay(90000)
    expect((await earnings()).balance).toBe(-6000)
  })

  it.each([
    ['zero', 0],
    ['a negative amount', -100],
    ['a fraction of a piaster', 1.5],
    ['not a number', Number.NaN],
    ['more than EGP 10,000,000', 1_000_000_001],
  ])('refuses %s, saving nothing', async (_label, amount) => {
    await expect(pay(amount)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    expect((await earnings()).totalPaidOut).toBe(0)
  })

  it('refuses a bad date, a date more than a day ahead, and a note over 500 characters', async () => {
    await expect(pay(100, { paidAt: 'yesterday' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    await expect(
      pay(100, { paidAt: new Date(Date.now() + 7 * 86400_000).toISOString() }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    await expect(pay(100, { note: 'x'.repeat(501) })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    expect((await earnings()).payouts).toHaveLength(0)
  })

  it('refuses anyone who is not a doctor account', async () => {
    const student = await makeUser(payload, 'student')
    await expect(
      recordPayout({ doctorId: student.id, amount: 100, req: await requestFor(payload, owner) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      recordPayout({ doctorId: manager.id, amount: 100, req: await requestFor(payload, owner) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      recordPayout({
        doctorId: '00000000-0000-0000-0000-000000000000',
        amount: 100,
        req: await requestFor(payload, owner),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('records every one of several payouts made at the same instant', async () => {
    await Promise.all([pay(100), pay(200), pay(300)])
    const result = await earnings()
    expect(result.payouts).toHaveLength(3)
    expect(result.totalPaidOut).toBe(600)
  })
})

describe('deleting a payout (to correct a mistake)', () => {
  it("needs the owner's password; then it is gone, the balance recovers, and the doctor is told", async () => {
    const payout = await pay(30000)
    emails.reset()

    await expect(
      deletePayout(payout.id, 'wrong-password', await requestFor(payload, owner)),
    ).rejects.toMatchObject({ code: 'WRONG_PASSWORD' })
    await expect(
      deletePayout(payout.id, '', await requestFor(payload, owner)),
    ).rejects.toMatchObject({ code: 'WRONG_PASSWORD' })
    expect((await earnings()).totalPaidOut).toBe(30000) // still there

    await deletePayout(payout.id, PASSWORD, await requestFor(payload, owner))
    expect(await earnings()).toMatchObject({ totalPaidOut: 0, balance: 84000, payouts: [] })
    expect(emails.to(doctor.email)).toHaveLength(1)
    expect(emails.to(doctor.email)[0]?.subject).toContain('Payout record removed')

    await expect(
      deletePayout(payout.id, PASSWORD, await requestFor(payload, owner)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('is the owner only: not a manager, the doctor, or a guest', async () => {
    const payout = await pay(100)
    for (const who of [manager, doctor]) {
      await expect(
        deletePayout(payout.id, PASSWORD, await requestFor(payload, who)),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
    await expect(
      deletePayout(payout.id, PASSWORD, await requestFor(payload, null)),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect((await earnings()).payouts).toHaveLength(1)
  })
})

describe('the owner overview', () => {
  it('lists every doctor with earned, paid out, and balance', async () => {
    await pay(30000)
    const rows = await listDoctorBalances(owner)
    expect(rows.find((row) => row.id === doctor.id)).toMatchObject({
      earned: 84000,
      paidOut: 30000,
      balance: 54000,
    })
  })

  it('shows a doctor with no sales at zero, and sorts the biggest balance first', async () => {
    const newcomer = await makeUser(payload, 'admin')
    const rows = await listDoctorBalances(owner)
    expect(rows.find((row) => row.id === newcomer.id)).toMatchObject({
      earned: 0,
      paidOut: 0,
      balance: 0,
    })
    const balances = rows.map((row) => row.balance)
    expect(balances).toEqual([...balances].sort((a, b) => b - a))
  })

  it('is for the owner only: managers, doctors, and students are refused', async () => {
    const student = await makeUser(payload, 'student')
    await expect(listDoctorBalances(manager)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(listDoctorBalances(doctor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(listDoctorBalances(student)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
