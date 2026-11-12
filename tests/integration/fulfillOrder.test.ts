import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { fulfillOrder } from '@/lib/orders/fulfillOrder'
import { startOrder } from '@/lib/orders/startOrder'
import { cancelOrder } from '@/lib/orders/cancelOrder'
import { rejectReceipt } from '@/lib/orders/reviewReceipt'
import type { Course, User } from '@/payload-types'

import {
  enrollmentsOf,
  makeAwaitingReview,
  makeCourse,
  makeLesson,
  makeUser,
  reload,
  requestFor,
  setPaymentSettings,
} from '../support/factories'
import { emails, startApp, stopApp } from '../support/payload'

let payload: Payload
let doctor: User
let manager: User
let student: User
let course: Course

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  doctor = await makeUser(payload, 'admin')
  manager = await makeUser(payload, 'manager')
  course = await makeCourse(payload, doctor, { price: 40000 })
  await makeLesson(payload, course)
})
afterAll(() => stopApp(payload))
beforeEach(async () => {
  emails.reset()
  student = await makeUser(payload, 'student')
})

describe('fulfillOrder', () => {
  it('marks the order paid and gives the student one active enrollment', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    expect(waiting.status).toBe('awaiting_review')
    expect(await enrollmentsOf(payload, student, course)).toHaveLength(0)

    const paid = await fulfillOrder(waiting.id, await requestFor(payload, manager))

    expect(paid.status).toBe('paid')
    expect(paid.paidAt).toBeTruthy()
    const enrollments = await enrollmentsOf(payload, student, course)
    expect(enrollments).toHaveLength(1)
    expect(enrollments[0]).toMatchObject({ status: 'active', order: paid.id })
  })

  it('emails the student exactly once', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    emails.reset()
    await fulfillOrder(waiting.id, await requestFor(payload, manager))
    expect(emails.to(student.email)).toHaveLength(1)
    expect(emails.to(student.email)[0]?.subject).toContain('Payment approved')
  })

  it('is idempotent: calling it again changes nothing and sends nothing', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    const first = await fulfillOrder(waiting.id, await requestFor(payload, manager))
    emails.reset()

    const second = await fulfillOrder(waiting.id, await requestFor(payload, manager))

    expect(second.status).toBe('paid')
    expect(second.paidAt).toBe(first.paidAt) // not stamped again
    expect(await enrollmentsOf(payload, student, course)).toHaveLength(1)
    expect(emails.to(student.email)).toHaveLength(0)
  })

  it('survives many callers at the same instant: one enrollment, one email', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    emails.reset()

    const results = await Promise.all(
      Array.from({ length: 6 }, async () =>
        fulfillOrder(waiting.id, await requestFor(payload, manager)),
      ),
    )

    expect(results.every((order) => order.status === 'paid')).toBe(true)
    expect(await enrollmentsOf(payload, student, course)).toHaveLength(1)
    expect(emails.to(student.email)).toHaveLength(1)
  })

  it('reactivates a revoked enrollment instead of creating a second one', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    await fulfillOrder(waiting.id, await requestFor(payload, manager))
    const [enrollment] = await enrollmentsOf(payload, student, course)
    await payload.update({
      collection: 'enrollments',
      id: enrollment!.id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })
    // the order that was refunded is finished; the student buys again
    await payload.update({
      collection: 'orders',
      id: waiting.id,
      data: { status: 'refunded' },
      overrideAccess: true,
    })

    const again = await makeAwaitingReview(payload, student, course)
    await fulfillOrder(again.id, await requestFor(payload, manager))

    const enrollments = await enrollmentsOf(payload, student, course)
    expect(enrollments).toHaveLength(1)
    expect(enrollments[0]).toMatchObject({ id: enrollment!.id, status: 'active', order: again.id })
  })

  it('refuses a paid-course order that has no receipt yet', async () => {
    const { order } = await startOrder({
      courseId: course.id,
      method: 'instapay',
      req: await requestFor(payload, student),
    })
    expect(order.status).toBe('pending')
    await expect(fulfillOrder(order.id, await requestFor(payload, manager))).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    })
    expect((await reload(payload, order)).status).toBe('pending')
    expect(await enrollmentsOf(payload, student, course)).toHaveLength(0)
  })

  it.each([
    [
      'cancelled',
      async (orderId: string, req: Awaited<ReturnType<typeof requestFor>>) =>
        cancelOrder(orderId, req),
    ],
  ])('refuses an order that is %s', async (_label, finish) => {
    const { order } = await startOrder({
      courseId: course.id,
      method: 'instapay',
      req: await requestFor(payload, student),
    })
    await finish(order.id, await requestFor(payload, student))
    await expect(fulfillOrder(order.id, await requestFor(payload, manager))).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    })
    expect(await enrollmentsOf(payload, student, course)).toHaveLength(0)
  })

  it('refuses an order a manager rejected', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    await rejectReceipt(waiting.id, 'blurry', await requestFor(payload, manager))
    await expect(
      fulfillOrder(waiting.id, await requestFor(payload, manager)),
    ).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    })
  })

  it('says not found for an order that does not exist', async () => {
    await expect(
      fulfillOrder('00000000-0000-0000-0000-000000000000', await requestFor(payload, manager)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('completes a free course on the spot, with no receipt and no email', async () => {
    const free = await makeCourse(payload, doctor, { price: 0 })
    const { order } = await startOrder({
      courseId: free.id,
      req: await requestFor(payload, student),
    })
    expect(order).toMatchObject({ status: 'paid', amount: 0, ownerAmount: 0 })
    expect(await enrollmentsOf(payload, student, free)).toHaveLength(1)
    expect(emails.sent).toHaveLength(0)
  })

  it('is all-or-nothing: if the enrollment cannot be created, the order does not become paid', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    const original = payload.create.bind(payload)
    const spy = vi.spyOn(payload, 'create').mockImplementation(((args: { collection: string }) => {
      if (args.collection === 'enrollments') throw new Error('database went away')
      return original(args as never)
    }) as unknown as typeof payload.create)

    await expect(fulfillOrder(waiting.id, await requestFor(payload, manager))).rejects.toThrow(
      'database went away',
    )
    spy.mockRestore()

    expect((await reload(payload, waiting)).status).toBe('awaiting_review') // rolled back
    expect(await enrollmentsOf(payload, student, course)).toHaveLength(0)
    // and it can still be completed afterwards
    await expect(
      fulfillOrder(waiting.id, await requestFor(payload, manager)),
    ).resolves.toMatchObject({ status: 'paid' })
  })

  it('does not let a receipt upload skip the price lock', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    expect(waiting).toMatchObject({ amount: 40000, ownerAmount: 28000 })
    expect(waiting.amountFrozenAt).toBeTruthy()
    expect(waiting.owner).toBe(doctor.id)
  })
})
