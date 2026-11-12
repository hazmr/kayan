import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { hasFullCourseAccess } from '@/lib/enrollments/canWatchLesson'
import { fulfillOrder } from '@/lib/orders/fulfillOrder'
import {
  cancelRefundRequest,
  declineRefund,
  refundOrder,
  requestRefund,
} from '@/lib/orders/refunds'
import { startOrder } from '@/lib/orders/startOrder'
import type { Course, Order, User } from '@/payload-types'

import {
  enrollmentsOf,
  makeAwaitingReview,
  makeCourse,
  makeLesson,
  makePaidOrder,
  makeUser,
  reload,
  requestFor,
  setPaymentSettings,
} from '../support/factories'
import { emails, startApp, stopApp } from '../support/payload'

let payload: Payload
let doctor: User
let manager: User
let owner: User
let student: User
let course: Course
let paid: Order

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  doctor = await makeUser(payload, 'admin')
  manager = await makeUser(payload, 'manager')
  owner = await makeUser(payload, 'superadmin')
  course = await makeCourse(payload, doctor, { price: 40000 })
  await makeLesson(payload, course)
})
afterAll(() => stopApp(payload))
beforeEach(async () => {
  student = await makeUser(payload, 'student')
  paid = await makePaidOrder(payload, student, course, manager)
  emails.reset()
})

describe('refundOrder (called only AFTER the money was sent back)', () => {
  it("marks the order refunded, records who did it, and removes the student's access", async () => {
    expect(await hasFullCourseAccess(student, course, payload)).toBe(true)

    const refunded = await refundOrder(paid.id, await requestFor(payload, manager))

    expect(refunded.status).toBe('refunded')
    expect(refunded.refundedAt).toBeTruthy()
    expect(refunded.refundedBy).toBe(manager.id)
    expect((await enrollmentsOf(payload, student, course))[0]?.status).toBe('revoked')
    expect(await hasFullCourseAccess(student, course, payload)).toBe(false)
  })

  it('emails the student exactly once', async () => {
    await refundOrder(paid.id, await requestFor(payload, manager))
    expect(emails.to(student.email)).toHaveLength(1)
    expect(emails.to(student.email)[0]?.subject).toContain('Refund sent')
  })

  it('works for the owner too', async () => {
    await expect(refundOrder(paid.id, await requestFor(payload, owner))).resolves.toMatchObject({
      status: 'refunded',
    })
  })

  it('is idempotent: a second call changes nothing and sends nothing', async () => {
    const first = await refundOrder(paid.id, await requestFor(payload, manager))
    emails.reset()
    const second = await refundOrder(paid.id, await requestFor(payload, owner))
    expect(second.status).toBe('refunded')
    expect(second.refundedAt).toBe(first.refundedAt)
    expect(second.refundedBy).toBe(manager.id) // still the first person
    expect(emails.sent).toHaveLength(0)
  })

  it('survives many callers at the same instant: refunded once, one email', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, async () =>
        refundOrder(paid.id, await requestFor(payload, manager)),
      ),
    )
    expect(results.every((order) => order.status === 'refunded')).toBe(true)
    expect(emails.to(student.email)).toHaveLength(1)
    expect(await enrollmentsOf(payload, student, course)).toHaveLength(1)
  })

  it('lets the student buy again afterwards and reactivates the same enrollment', async () => {
    await refundOrder(paid.id, await requestFor(payload, manager))
    const [before] = await enrollmentsOf(payload, student, course)
    const again = await makeAwaitingReview(payload, student, course)
    await fulfillOrder(again.id, await requestFor(payload, manager))
    const enrollments = await enrollmentsOf(payload, student, course)
    expect(enrollments).toHaveLength(1)
    expect(enrollments[0]).toMatchObject({ id: before!.id, status: 'active' })
  })

  it('refuses a student, a doctor, and a guest', async () => {
    await expect(refundOrder(paid.id, await requestFor(payload, student))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(refundOrder(paid.id, await requestFor(payload, doctor))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(refundOrder(paid.id, await requestFor(payload, null))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    expect((await reload(payload, paid)).status).toBe('paid')
  })

  it('refuses an order that is not paid', async () => {
    const other = await makeUser(payload, 'student')
    const waiting = await makeAwaitingReview(payload, other, course)
    await expect(refundOrder(waiting.id, await requestFor(payload, manager))).rejects.toMatchObject(
      {
        code: 'ORDER_INVALID_STATE',
      },
    )
  })

  it('refuses a free order: there is nothing to give back', async () => {
    const free = await makeCourse(payload, doctor, { price: 0 })
    const { order } = await startOrder({
      courseId: free.id,
      req: await requestFor(payload, student),
    })
    await expect(refundOrder(order.id, await requestFor(payload, manager))).rejects.toMatchObject({
      code: 'REFUND_NOT_ALLOWED',
    })
    await expect(
      requestRefund(order.id, { reason: 'x', refundTo: 'y' }, await requestFor(payload, student)),
    ).rejects.toMatchObject({
      code: 'REFUND_NOT_ALLOWED',
    })
  })
})

describe('refund requests', () => {
  const ask = async () =>
    requestRefund(
      paid.id,
      { reason: 'Wrong course', refundTo: '01012345678' },
      await requestFor(payload, student),
    )

  it('stores the reason and where to send the money, and the student keeps access', async () => {
    const order = await ask()
    expect(order).toMatchObject({
      status: 'paid',
      refundStatus: 'requested',
      refundReason: 'Wrong course',
      refundTo: '01012345678',
    })
    expect(await hasFullCourseAccess(student, course, payload)).toBe(true)
  })

  it('allows only one open request, and only the buyer can make it', async () => {
    await ask()
    await expect(ask()).rejects.toMatchObject({ code: 'REFUND_ALREADY_REQUESTED' })
    const stranger = await makeUser(payload, 'student')
    await expect(
      requestRefund(paid.id, { reason: 'x', refundTo: 'y' }, await requestFor(payload, stranger)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('needs a reason and a destination', async () => {
    for (const input of [
      { reason: ' ', refundTo: 'x' },
      { reason: 'x', refundTo: '' },
      { reason: 'x'.repeat(1001), refundTo: 'x' },
    ]) {
      await expect(
        requestFor(payload, student).then((req) => requestRefund(paid.id, input, req)),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      })
    }
  })

  it('can be withdrawn once, and then asked for again', async () => {
    await ask()
    const withdrawn = await cancelRefundRequest(paid.id, await requestFor(payload, student))
    expect(withdrawn).toMatchObject({ refundStatus: 'none', refundReason: null })
    await expect(
      cancelRefundRequest(paid.id, await requestFor(payload, student)),
    ).rejects.toMatchObject({ code: 'REFUND_NOT_ALLOWED' })
    await expect(ask()).resolves.toMatchObject({ refundStatus: 'requested' })
  })

  it('can be declined with a note: the student is emailed and keeps access', async () => {
    await ask()
    emails.reset()
    const declined = await declineRefund(
      paid.id,
      'Already watched everything',
      await requestFor(payload, manager),
    )
    expect(declined).toMatchObject({
      refundStatus: 'declined',
      refundDecisionNote: 'Already watched everything',
      status: 'paid',
    })
    expect(emails.to(student.email)).toHaveLength(1)
    expect(emails.to(student.email)[0]?.html).toContain('Already watched everything')
    expect(await hasFullCourseAccess(student, course, payload)).toBe(true)
    await expect(ask()).resolves.toMatchObject({
      refundStatus: 'requested',
      refundDecisionNote: null,
    }) // may ask again
  })

  it('cannot be declined without a note, or when nothing was requested', async () => {
    await expect(
      declineRefund(paid.id, 'x', await requestFor(payload, manager)),
    ).rejects.toMatchObject({ code: 'REFUND_NOT_ALLOWED' })
    await ask()
    await expect(
      declineRefund(paid.id, '  ', await requestFor(payload, manager)),
    ).rejects.toMatchObject({ code: 'REVIEW_NOTE_REQUIRED' })
  })
})
