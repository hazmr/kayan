import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { changeCourseStatus } from '@/lib/courses/changeCourseStatus'
import { cancelOrder } from '@/lib/orders/cancelOrder'
import { changeMethod } from '@/lib/orders/changeMethod'
import { approveReceipt, rejectReceipt } from '@/lib/orders/reviewReceipt'
import { startOrder } from '@/lib/orders/startOrder'
import { submitReceipt } from '@/lib/orders/submitReceipt'
import type { Course, User } from '@/payload-types'

import {
  enrollmentsOf,
  makeAwaitingReview,
  makeCourse,
  makeLesson,
  makeUser,
  receiptFile,
  reload,
  requestFor,
  setAdminSharePercent,
  setPaymentSettings,
} from '../support/factories'
import { emails, startApp, stopApp } from '../support/payload'

let payload: Payload
let doctor: User
let otherDoctor: User
let staff: User
let owner: User
let student: User
let course: Course

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  doctor = await makeUser(payload, 'admin')
  otherDoctor = await makeUser(payload, 'admin')
  staff = await makeUser(payload, 'admin', 'staff')
  owner = await makeUser(payload, 'superadmin')
  await setAdminSharePercent(payload, 30)
  course = await makeCourse(payload, doctor, { price: 40000 })
  await makeLesson(payload, course)
})
afterAll(() => stopApp(payload))
beforeEach(async () => {
  emails.reset()
  student = await makeUser(payload, 'student')
})

const start = async (who = student, target = course) =>
  startOrder({ courseId: target.id, method: 'instapay', req: await requestFor(payload, who) })
const upload = async (orderId: string, amount = 40000, who = student, sender = '01012345678') =>
  submitReceipt({
    orderId,
    file: receiptFile(),
    senderNumber: sender,
    expectedAmount: amount,
    req: await requestFor(payload, who),
  })

describe('starting an order', () => {
  it('creates a pending order at the course price, with a reference like KY-XXXXXX', async () => {
    const { order, resumed } = await start()
    expect(resumed).toBe(false)
    expect(order).toMatchObject({
      status: 'pending',
      amount: 40000,
      method: 'instapay',
      provider: 'manual',
    })
    expect(order.reference).toMatch(/^KY-[23456789A-HJ-NP-Z]{6}$/)
    expect(order.amountFrozenAt).toBeFalsy()
  })

  it('gives back the same order when one is already open (no second order)', async () => {
    const first = await start()
    const second = await start()
    expect(second.resumed).toBe(true)
    expect(second.order.id).toBe(first.order.id)
  })

  it('creates exactly one order when started four times at the same instant', async () => {
    const results = await Promise.all([start(), start(), start(), start()])
    expect(new Set(results.map((result) => result.order.id)).size).toBe(1)
    expect(results.filter((result) => !result.resumed)).toHaveLength(1)
    const { totalDocs } = await payload.count({
      collection: 'orders',
      where: { user: { equals: student.id } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
  })

  it('has the database refuse a second open order even if the code did not', async () => {
    const { order } = await start()
    await expect(
      payload.create({
        collection: 'orders',
        data: {
          user: student.id,
          course: course.id,
          amount: 1,
          status: 'pending',
          refundStatus: 'none',
          reference: 'KY-DUPLIC',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    // a finished order does not count as open
    await cancelOrder(order.id, await requestFor(payload, student))
    await expect(start()).resolves.toMatchObject({ resumed: false })
  })

  it('refuses a guest, an unpublished course, a missing course, and a method that is not set up', async () => {
    await expect(
      startOrder({ courseId: course.id, method: 'instapay', req: await requestFor(payload, null) }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    const draft = await makeCourse(payload, doctor, { status: 'draft' })
    await expect(start(student, draft)).rejects.toMatchObject({ code: 'COURSE_NOT_PURCHASABLE' })
    await expect(
      startOrder({
        courseId: '00000000-0000-0000-0000-000000000000',
        method: 'instapay',
        req: await requestFor(payload, student),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      startOrder({ courseId: course.id, req: await requestFor(payload, student) }),
    ).rejects.toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' })

    await payload.updateGlobal({
      slug: 'payment-settings',
      data: { vodafoneCashNumber: '' },
      overrideAccess: true,
    })
    await expect(
      startOrder({
        courseId: course.id,
        method: 'vodafone_cash',
        req: await requestFor(payload, student),
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' })
    await setPaymentSettings(payload)
  })

  it('refuses a student who already owns the course', async () => {
    const waiting = await makeAwaitingReview(payload, student, course)
    await approveReceipt(waiting.id, await requestFor(payload, staff))
    await expect(start()).rejects.toMatchObject({ code: 'ALREADY_ENROLLED' })
  })

  it('lets the student switch payment method only while pending', async () => {
    const { order } = await start()
    const switched = await changeMethod(
      order.id,
      'vodafone_cash',
      await requestFor(payload, student),
    )
    expect(switched.method).toBe('vodafone_cash')
    await upload(order.id)
    await expect(
      changeMethod(order.id, 'instapay', await requestFor(payload, student)),
    ).rejects.toMatchObject({ code: 'ORDER_INVALID_STATE' })
  })
})

describe('the receipt locks the price', () => {
  it("freezes the amount and the Admin's share (rounded down, at today's percent)", async () => {
    const odd = await makeCourse(payload, doctor, { price: 10101 })
    const { order } = await start(student, odd)
    const waiting = await upload(order.id, 10101)
    expect(waiting).toMatchObject({
      status: 'awaiting_review',
      amount: 10101,
      adminAmount: 3030, // 30% of 10101 = 3030.3, rounded down
    })
    expect(waiting.amountFrozenAt).toBeTruthy()
  })

  it("is not changed by a later price change, or a change to the Admin's percent", async () => {
    const mine = await makeCourse(payload, doctor, { price: 40000 })
    const { order } = await start(student, mine)
    await upload(order.id)
    await payload.update({
      collection: 'courses',
      id: mine.id,
      data: { price: 99000, owner: otherDoctor.id },
      overrideAccess: true,
    })
    await setAdminSharePercent(payload, 50)
    expect(await reload(payload, order)).toMatchObject({ amount: 40000, adminAmount: 12000 })
    await setAdminSharePercent(payload, 30)
  })

  it('refuses the upload, saving nothing, when the price moved after the student saw it', async () => {
    const mine = await makeCourse(payload, doctor, { price: 40000 })
    const { order } = await start(student, mine)
    await payload.update({
      collection: 'courses',
      id: mine.id,
      data: { price: 55000 },
      overrideAccess: true,
    })

    await expect(upload(order.id, 40000)).rejects.toMatchObject({ code: 'ORDER_PRICE_CHANGED' })
    expect((await reload(payload, order)).status).toBe('pending')
    const { totalDocs } = await payload.count({
      collection: 'receipts',
      where: { order: { equals: order.id } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)

    const ok = await upload(order.id, 55000) // with the new amount it works
    expect(ok).toMatchObject({ amount: 55000, adminAmount: 16500 }) // 30%
  })

  it('tells the managers a receipt is waiting', async () => {
    await upload((await start()).order.id)
    const mail = emails.withSubject('New receipt to review')
    expect(mail.map((email) => email.to)).toContain(staff.email)
    expect(mail.map((email) => email.to)).toContain(owner.email)
    expect(mail.map((email) => email.to)).not.toContain(student.email)
  })
})

describe('checking the receipt file', () => {
  it('refuses a file type that is not JPEG, PNG, or WebP', async () => {
    const { order } = await start()
    await expect(
      submitReceipt({
        orderId: order.id,
        file: {
          data: Buffer.from('%PDF-1.4'),
          mimetype: 'application/pdf',
          name: 'a.pdf',
          size: 8,
        },
        senderNumber: '010',
        expectedAmount: 40000,
        req: await requestFor(payload, student),
      }),
    ).rejects.toMatchObject({ code: 'RECEIPT_INVALID_TYPE' })
  })

  it('refuses text pretending to be an image (the real contents are checked)', async () => {
    const { order } = await start()
    await expect(
      submitReceipt({
        orderId: order.id,
        file: {
          data: Buffer.from('this is not an image'),
          mimetype: 'image/png',
          name: 'x.png',
          size: 20,
        },
        senderNumber: '010',
        expectedAmount: 40000,
        req: await requestFor(payload, student),
      }),
    ).rejects.toMatchObject({ code: 'RECEIPT_INVALID_TYPE' })
    expect((await reload(payload, order)).status).toBe('pending')
  })

  it('refuses a file over 5 MB', async () => {
    const { order } = await start()
    await expect(
      submitReceipt({
        orderId: order.id,
        file: { ...receiptFile(), size: 5 * 1024 * 1024 + 1 },
        senderNumber: '010',
        expectedAmount: 40000,
        req: await requestFor(payload, student),
      }),
    ).rejects.toMatchObject({ code: 'RECEIPT_TOO_LARGE' })
  })

  it('needs a sender number', async () => {
    const { order } = await start()
    await expect(upload(order.id, 40000, student, '   ')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    await expect(upload(order.id, 40000, student, 'x'.repeat(41))).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('stores the file under a random name, not the name it was sent with', async () => {
    const waiting = await upload((await start()).order.id)
    const { docs } = await payload.find({
      collection: 'receipts',
      where: { order: { equals: waiting.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(docs[0]?.filename).toMatch(/^[0-9a-f-]{36}\.png$/)
  })

  it("only the order's student can upload, and not while it is under review", async () => {
    const { order } = await start()
    const stranger = await makeUser(payload, 'student')
    await expect(upload(order.id, 40000, stranger)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await upload(order.id)
    await expect(upload(order.id)).rejects.toMatchObject({ code: 'ORDER_INVALID_STATE' })
  })
})

describe('review: reject, upload again, approve', () => {
  it('walks pending -> awaiting_review -> rejected -> awaiting_review -> paid, keeping the amount locked', async () => {
    const { order } = await start()
    const first = await upload(order.id)
    const rejected = await rejectReceipt(
      order.id,
      'Amount does not match',
      await requestFor(payload, staff),
    )
    expect(rejected.status).toBe('rejected')
    expect(emails.to(student.email).at(-1)?.html).toContain('Amount does not match')

    const second = await upload(order.id, 40000, student, '01099999999')
    expect(second).toMatchObject({
      status: 'awaiting_review',
      amount: first.amount,
      adminAmount: first.adminAmount,
    })

    const paid = await approveReceipt(order.id, await requestFor(payload, staff))
    expect(paid.status).toBe('paid')

    const { docs } = await payload.find({
      collection: 'receipts',
      where: { order: { equals: order.id } },
      sort: 'createdAt',
      depth: 0,
      overrideAccess: true,
    })
    expect(docs.map((receipt) => receipt.decision)).toEqual(['rejected', 'approved'])
    expect(docs[0]).toMatchObject({ reviewNote: 'Amount does not match', reviewedBy: staff.id })
  })

  it('needs a note to reject, and cannot reject twice', async () => {
    const { order } = await start()
    await upload(order.id)
    await expect(
      rejectReceipt(order.id, '  ', await requestFor(payload, staff)),
    ).rejects.toMatchObject({ code: 'REVIEW_NOTE_REQUIRED' })
    await rejectReceipt(order.id, 'blurry', await requestFor(payload, staff))
    await expect(
      rejectReceipt(order.id, 'again', await requestFor(payload, staff)),
    ).rejects.toMatchObject({ code: 'ORDER_INVALID_STATE' })
  })

  it('can only approve an order that has a receipt waiting; approving twice is harmless', async () => {
    const { order } = await start()
    await expect(approveReceipt(order.id, await requestFor(payload, staff))).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATE',
    })
    await upload(order.id)
    await approveReceipt(order.id, await requestFor(payload, staff))
    emails.reset()
    await expect(approveReceipt(order.id, await requestFor(payload, owner))).resolves.toMatchObject(
      { status: 'paid' },
    )
    expect(emails.sent).toHaveLength(0)
  })

  it('lets the student cancel a pending or rejected order, but not one under review or paid', async () => {
    const a = await start()
    await expect(
      cancelOrder(a.order.id, await requestFor(payload, student)),
    ).resolves.toMatchObject({ status: 'cancelled' })
    await expect(cancelOrder(a.order.id, await requestFor(payload, student))).rejects.toMatchObject(
      { code: 'ORDER_INVALID_STATE' },
    )

    const b = await start()
    await upload(b.order.id)
    await expect(cancelOrder(b.order.id, await requestFor(payload, student))).rejects.toMatchObject(
      { code: 'ORDER_INVALID_STATE' },
    )
    await rejectReceipt(b.order.id, 'blurry', await requestFor(payload, staff))
    await expect(
      cancelOrder(b.order.id, await requestFor(payload, student)),
    ).resolves.toMatchObject({ status: 'cancelled' })

    const c = await start()
    await upload(c.order.id)
    await approveReceipt(c.order.id, await requestFor(payload, staff))
    await expect(cancelOrder(c.order.id, await requestFor(payload, student))).rejects.toMatchObject(
      { code: 'ORDER_INVALID_STATE' },
    )
  })

  it("does not let one student cancel another student's order", async () => {
    const { order } = await start()
    const stranger = await makeUser(payload, 'student')
    await expect(cancelOrder(order.id, await requestFor(payload, stranger))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('courses with orders', () => {
  it('archiving cancels orders that were only started, and keeps receipts that are waiting', async () => {
    const mine = await makeCourse(payload, doctor, { price: 40000 })
    const started = await start(student, mine)
    const other = await makeUser(payload, 'student')
    const waiting = await upload((await start(other, mine)).order.id, 40000, other)

    await changeCourseStatus({
      courseId: mine.id,
      to: 'archived',
      req: await requestFor(payload, staff),
    })

    expect((await reload(payload, started.order)).status).toBe('cancelled')
    expect((await reload(payload, waiting)).status).toBe('awaiting_review')
    await expect(start(await makeUser(payload, 'student'), mine)).rejects.toMatchObject({
      code: 'COURSE_NOT_PURCHASABLE',
    })
    // money already sent is still honoured
    await expect(
      approveReceipt(waiting.id, await requestFor(payload, staff)),
    ).resolves.toMatchObject({ status: 'paid' })
  })

  it('cannot be deleted once it has an order, and cannot lose its owner account', async () => {
    const mine = await makeCourse(payload, doctor)
    await start(student, mine)
    await expect(
      payload.delete({ collection: 'courses', id: mine.id, overrideAccess: true }),
    ).rejects.toMatchObject({ code: 'COURSE_HAS_ENROLLMENTS' })
    await expect(
      payload.delete({ collection: 'users', id: student.id, overrideAccess: true }),
    ).rejects.toMatchObject({ code: 'USER_HAS_RECORDS' })
    expect(await enrollmentsOf(payload, student, mine)).toHaveLength(0)
  })

  it('can be deleted while it has no orders (its modules and lessons go with it)', async () => {
    const empty = await makeCourse(payload, doctor)
    const lesson = await makeLesson(payload, empty)
    await payload.delete({ collection: 'courses', id: empty.id, overrideAccess: true })
    await expect(
      payload.findByID({ collection: 'lessons', id: lesson.id, overrideAccess: true }),
    ).rejects.toThrow()
  })
})
