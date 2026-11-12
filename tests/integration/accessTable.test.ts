// One block per row of the access table, followed by the rules listed under it. Each row is tried
// as the Admin (role key superadmin, called "owner" here), the instructor who teaches the course
// ("doctor"), another instructor ("otherDoctor"), a student, and a guest. It is one academy, so
// both instructors may do the same things; the second one proves nothing depends on who teaches.
import type { Endpoint, Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Users } from '@/collections/Users'
import { changeCourseStatus } from '@/lib/courses/changeCourseStatus'
import { deleteAdminPayment, recordAdminPayment } from '@/lib/earnings/adminPayments'
import { getAcademyRevenue } from '@/lib/earnings/getAcademyRevenue'
import { AppError } from '@/lib/errors/AppError'
import { declineRefund, refundOrder, requestRefund } from '@/lib/orders/refunds'
import { approveReceipt, rejectReceipt } from '@/lib/orders/reviewReceipt'
import type { Course, User } from '@/payload-types'

import {
  makeAwaitingReview,
  makeCategory,
  makeCourse,
  makeLesson,
  makePaidOrder,
  makeUser,
  PASSWORD,
  requestFor,
  setPaymentSettings,
  unique,
} from '../support/factories'
import { startApp, stopApp } from '../support/payload'

type Who = 'owner' | 'doctor' | 'otherDoctor' | 'student' | 'guest'
const WHO: Who[] = ['owner', 'doctor', 'otherDoctor', 'student', 'guest']
type Expected = Record<Who, 'allowed' | 'denied'>
const YES = 'allowed'
const NO = 'denied'

let payload: Payload
let users: Record<Exclude<Who, 'guest'>, User>
const asUser = (who: Who): User | null => (who === 'guest' ? null : users[who])

/** 'allowed' if it worked, 'denied' if the system said no, or the code of any other failure. */
async function attempt(action: () => Promise<unknown>): Promise<string> {
  try {
    await action()
    return YES
  } catch (error) {
    if (error instanceof AppError) {
      return ['FORBIDDEN', 'UNAUTHENTICATED', 'NOT_FOUND'].includes(error.code) ? NO : error.code
    }
    const name = error instanceof Error ? error.name : String(error)
    return ['Forbidden', 'NotFound', 'UnauthorizedError'].includes(name)
      ? NO
      : `${name}: ${String(error)}`
  }
}

/** Runs `action` once per kind of person and checks each answer against the table. */
async function matrix(
  expected: Expected,
  action: (who: Who, user: User | null) => Promise<unknown>,
) {
  for (const who of WHO) {
    expect(await attempt(() => action(who, asUser(who))), who).toBe(expected[who])
  }
}

/** Calls one of the Users collection's own endpoints, as `user`. */
async function callUserEndpoint(
  path: string,
  user: User | null,
  id: string,
  body: Record<string, unknown>,
) {
  const endpoint = (Users.endpoints as Endpoint[]).find((candidate) => candidate.path === path)
  if (!endpoint) throw new Error(`No endpoint ${path}`)
  const req = await requestFor(payload, user)
  req.routeParams = { id }
  req.json = async () => body
  return endpoint.handler(req)
}

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  users = {
    owner: await makeUser(payload, 'superadmin'),
    doctor: await makeUser(payload, 'admin', 'doctor'),
    otherDoctor: await makeUser(payload, 'admin', 'otherDoctor'),
    student: await makeUser(payload, 'student'),
  }
})
afterAll(() => stopApp(payload))

const course = (options?: Parameters<typeof makeCourse>[2]) =>
  makeCourse(payload, users.doctor, options)
const read = (c: Course) =>
  payload.findByID({ collection: 'courses', id: c.id, depth: 0, overrideAccess: true })

describe('Change payment settings', () => {
  it('is for the Admin and instructors (it is the academy account; every change is emailed)', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      (_who, user) =>
        payload.updateGlobal({
          slug: 'payment-settings',
          data: { instapayAddress: 'checked@instapay' },
          user: user ?? undefined,
          overrideAccess: false,
        }),
    )
    await setPaymentSettings(payload)
  })

  it('can be read by the Admin and instructors only', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      (_who, user) =>
        payload.findGlobal({
          slug: 'payment-settings',
          user: user ?? undefined,
          overrideAccess: false,
        }),
    )
  })
})

describe('Create users / change roles', () => {
  it('creating an account is for the owner only (visitors can register, see below)', async () => {
    await matrix(
      { owner: YES, doctor: NO, otherDoctor: NO, student: NO, guest: YES },
      (_who, user) =>
        payload.create({
          collection: 'users',
          data: {
            name: 'New',
            email: `${unique('new')}@kayan.test`,
            password: PASSWORD,
            role: 'student',
          },
          user: user ?? undefined,
          overrideAccess: false,
          disableVerificationEmail: true,
        }),
    )
  })

  it('public registration always makes a student, whatever role is asked for', async () => {
    const registered = await payload.create({
      collection: 'users',
      data: {
        name: 'Sneaky',
        email: `${unique('sneaky')}@kayan.test`,
        password: PASSWORD,
        role: 'superadmin',
        _verified: true,
      },
      overrideAccess: false,
      disableVerificationEmail: true,
    })
    expect(registered.role).toBe('student')
    expect(registered._verified).toBeFalsy() // cannot skip email verification either
  })

  it('the Admin can create instructors and students directly, but never another Admin', async () => {
    for (const role of ['admin', 'student'] as const) {
      const created = await payload.create({
        collection: 'users',
        data: { name: role, email: `${unique(role)}@kayan.test`, password: PASSWORD, role },
        user: users.owner,
        overrideAccess: false,
        disableVerificationEmail: true,
      })
      expect(created.role).toBe(role)
    }
    expect(
      await attempt(() =>
        payload.create({
          collection: 'users',
          data: {
            name: 'x',
            email: `${unique('x')}@kayan.test`,
            password: PASSWORD,
            role: 'superadmin',
          },
          user: users.owner,
          overrideAccess: false,
          disableVerificationEmail: true,
        }),
      ),
    ).toBe(NO)
  })

  it('the role changes only through the password-confirmed endpoint, and only for the owner', async () => {
    await matrix(
      { owner: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const target = await makeUser(payload, 'student')
        return callUserEndpoint('/:id/role', user, target.id, {
          role: 'admin',
          password: PASSWORD,
        })
      },
    )
  })

  it('the owner must type their password, and cannot change their own role', async () => {
    const target = await makeUser(payload, 'student')
    expect(
      await attempt(() =>
        callUserEndpoint('/:id/role', users.owner, target.id, {
          role: 'admin',
          password: 'wrong',
        }),
      ),
    ).toBe('WRONG_PASSWORD')
    expect(
      await attempt(() => callUserEndpoint('/:id/role', users.owner, target.id, { role: 'admin' })),
    ).toBe('WRONG_PASSWORD')
    expect(
      await attempt(() =>
        callUserEndpoint('/:id/role', users.owner, users.owner.id, {
          role: 'student',
          password: PASSWORD,
        }),
      ),
    ).toBe('SELF_CHANGE_NOT_ALLOWED')
    expect(
      (await payload.findByID({ collection: 'users', id: target.id, overrideAccess: true })).role,
    ).toBe('student')
  })

  it("a normal save cannot change a role, not even the owner's", async () => {
    const target = await makeUser(payload, 'student')
    for (const user of [users.owner, users.doctor, target]) {
      await attempt(() =>
        payload.update({
          collection: 'users',
          id: target.id,
          data: { role: 'superadmin' },
          user,
          overrideAccess: false,
        }),
      )
      expect(
        (await payload.findByID({ collection: 'users', id: target.id, overrideAccess: true })).role,
        `as ${user.role}`,
      ).toBe('student')
    }
  })

  it('nobody can be made Admin, and the Admin role is never changed through the app', async () => {
    const target = await makeUser(payload, 'admin')
    expect(
      await attempt(() =>
        callUserEndpoint('/:id/role', users.owner, target.id, {
          role: 'superadmin',
          password: PASSWORD,
        }),
      ),
    ).toBe('VALIDATION_FAILED')
    // The Admin's own role never changes through the endpoint (the database also allows only one).
    expect(
      await attempt(() =>
        callUserEndpoint('/:id/role', users.owner, users.owner.id, {
          role: 'student',
          password: PASSWORD,
        }),
      ),
    ).toBe('SELF_CHANGE_NOT_ALLOWED')
    expect(
      (await payload.findByID({ collection: 'users', id: target.id, overrideAccess: true })).role,
    ).toBe('admin')
  })
})

describe('Delete courses or users', () => {
  it('deleting a course is for the owner only', async () => {
    await matrix(
      { owner: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const c = await course()
        return payload.delete({
          collection: 'courses',
          id: c.id,
          user: user ?? undefined,
          overrideAccess: false,
        })
      },
    )
  })

  it('a course with enrollments is archived, never deleted, even by the owner', async () => {
    const c = await course()
    await makePaidOrder(payload, await makeUser(payload, 'student'), c, users.owner)
    expect(
      await attempt(() =>
        payload.delete({
          collection: 'courses',
          id: c.id,
          user: users.owner,
          overrideAccess: false,
        }),
      ),
    ).toBe('COURSE_HAS_ENROLLMENTS')
    await changeCourseStatus({
      courseId: c.id,
      to: 'archived',
      req: await requestFor(payload, users.owner),
    })
    expect((await read(c)).status).toBe('archived')
  })

  it('deleting a user is for the owner only, through the password-confirmed endpoint', async () => {
    await matrix(
      { owner: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const victim = await makeUser(payload, 'student')
        return callUserEndpoint('/:id/delete', user, victim.id, { password: PASSWORD })
      },
    )
  })

  it('the generic delete is closed to everyone, the owner included', async () => {
    const victim = await makeUser(payload, 'student')
    for (const who of WHO) {
      expect(
        await attempt(() =>
          payload.delete({
            collection: 'users',
            id: victim.id,
            user: asUser(who) ?? undefined,
            overrideAccess: false,
          }),
        ),
        who,
      ).toBe(NO)
    }
  })

  it("needs the owner's password, and refuses someone with courses, orders, or enrollments", async () => {
    const victim = await makeUser(payload, 'student')
    expect(
      await attempt(() =>
        callUserEndpoint('/:id/delete', users.owner, victim.id, { password: 'wrong' }),
      ),
    ).toBe('WRONG_PASSWORD')
    const buyer = await makeUser(payload, 'student')
    await makeAwaitingReview(payload, buyer, await course())
    expect(
      await attempt(() =>
        callUserEndpoint('/:id/delete', users.owner, buyer.id, { password: PASSWORD }),
      ),
    ).toBe('USER_HAS_RECORDS')
    expect(
      await attempt(() =>
        callUserEndpoint('/:id/delete', users.owner, users.doctor.id, { password: PASSWORD }),
      ),
    ).toBe('USER_HAS_RECORDS')
  })
})

describe("Set the Admin's percent of each sale", () => {
  it('changing it is for the Admin only', async () => {
    await matrix(
      { owner: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      (_who, user) =>
        payload.updateGlobal({
          slug: 'platform-settings',
          data: { adminSharePercent: 0 },
          user: user ?? undefined,
          overrideAccess: false,
        }),
    )
  })

  it('reading it is for the Admin and instructors (they pay it), not students', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      (_who, user) =>
        payload.findGlobal({
          slug: 'platform-settings',
          user: user ?? undefined,
          overrideAccess: false,
        }),
    )
  })
})

describe('Record payments to the Admin', () => {
  it('recording one is for the Admin and instructors', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) =>
        recordAdminPayment({ amount: 100, req: await requestFor(payload, user) }),
    )
  })

  it("removing one is for the Admin only, with the Admin's password", async () => {
    await matrix(
      { owner: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const payment = await recordAdminPayment({
          amount: 100,
          req: await requestFor(payload, users.owner),
        })
        return deleteAdminPayment(payment.id, PASSWORD, await requestFor(payload, user))
      },
    )
  })
})

describe('Approve or reject receipts', () => {
  it('approving is for the Admin and instructors', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const waiting = await makeAwaitingReview(
          payload,
          await makeUser(payload, 'student'),
          await course(),
        )
        return approveReceipt(waiting.id, await requestFor(payload, user))
      },
    )
  })

  it('rejecting is for the Admin and instructors', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const waiting = await makeAwaitingReview(
          payload,
          await makeUser(payload, 'student'),
          await course(),
        )
        return rejectReceipt(waiting.id, 'not found', await requestFor(payload, user))
      },
    )
  })

  it('the buyer cannot approve their own receipt', async () => {
    const buyer = await makeUser(payload, 'student')
    const waiting = await makeAwaitingReview(payload, buyer, await course())
    expect(
      await attempt(async () => approveReceipt(waiting.id, await requestFor(payload, buyer))),
    ).toBe(NO)
  })
})

describe('Refund orders', () => {
  it('marking an order refunded is for the Admin and instructors', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const paid = await makePaidOrder(
          payload,
          await makeUser(payload, 'student'),
          await course(),
          users.owner,
        )
        return refundOrder(paid.id, await requestFor(payload, user))
      },
    )
  })

  it('declining a refund request is for the Admin and instructors', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const buyer = await makeUser(payload, 'student')
        const paid = await makePaidOrder(payload, buyer, await course(), users.owner)
        await requestRefund(
          paid.id,
          { reason: 'x', refundTo: 'y' },
          await requestFor(payload, buyer),
        )
        return declineRefund(paid.id, 'no', await requestFor(payload, user))
      },
    )
  })
})

describe('Publish courses', () => {
  it('publishing a finished draft is for the Admin and every instructor', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const c = await course({ status: 'draft' })
        await completeCourse(c)
        return changeCourseStatus({
          courseId: c.id,
          to: 'published',
          req: await requestFor(payload, user),
        })
      },
    )
  })

  it('an unfinished draft cannot be published', async () => {
    const c = await course({ status: 'draft' }) // no category, thumbnail, or lesson
    expect(
      await attempt(async () =>
        changeCourseStatus({
          courseId: c.id,
          to: 'published',
          req: await requestFor(payload, users.doctor),
        }),
      ),
    ).toBe('COURSE_INCOMPLETE')
  })

  it('a published course cannot go back to draft', async () => {
    const c = await course({ status: 'published' })
    expect(
      await attempt(async () =>
        changeCourseStatus({
          courseId: c.id,
          to: 'draft',
          req: await requestFor(payload, users.owner),
        }),
      ),
    ).toBe('COURSE_INVALID_STATE')
  })

  it('archiving and un-archiving are for the Admin and instructors', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const live = await course({ status: 'published' })
        await changeCourseStatus({
          courseId: live.id,
          to: 'archived',
          req: await requestFor(payload, user),
        })
        return changeCourseStatus({
          courseId: live.id,
          to: 'published',
          req: await requestFor(payload, user),
        })
      },
    )
  })

  it('the status field itself is closed: nobody can set it by editing the course', async () => {
    const c = await course({ status: 'draft' })
    for (const who of ['owner', 'doctor'] as const) {
      await attempt(() =>
        payload.update({
          collection: 'courses',
          id: c.id,
          data: { status: 'published' },
          locale: 'ar',
          user: users[who],
          overrideAccess: false,
        }),
      )
      expect((await read(c)).status, who).toBe('draft')
    }
  })
})

/** Gives a draft the category, thumbnail and lesson that publishing requires. */
async function completeCourse(c: Course): Promise<void> {
  const category = await makeCategory(payload)
  const media = await payload.create({
    collection: 'media',
    data: { alt: 'x' },
    file: {
      data: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      ),
      mimetype: 'image/png',
      name: `${unique('thumb')}.png`,
      size: 70,
    },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'courses',
    id: c.id,
    data: { category: category.id, thumbnail: media.id },
    locale: 'ar',
    overrideAccess: true,
  })
  await makeLesson(payload, c)
}

describe('Edit courses, modules, lessons', () => {
  it('courses: all for the Admin and every instructor, none for a student', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const c = await course()
        return payload.update({
          collection: 'courses',
          id: c.id,
          data: { title: 'edited' },
          locale: 'ar',
          user: user ?? undefined,
          overrideAccess: false,
        })
      },
    )
  })

  it('modules: same rule', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const c = await course()
        return payload.create({
          collection: 'modules',
          data: { title: 'm', course: c.id, position: 1 },
          locale: 'ar',
          user: user ?? undefined,
          overrideAccess: false,
        })
      },
    )
  })

  it('lessons: same rule, for adding, editing, and deleting', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        const c = await course()
        const existing = await makeLesson(payload, c)
        return payload.create({
          collection: 'lessons',
          data: {
            title: 'l',
            module: typeof existing.module === 'string' ? existing.module : existing.module.id,
            position: 2,
            videoProvider: 'youtube',
            videoId: 'abcdefghijk',
            durationSeconds: 1,
            isFreePreview: false,
          },
          locale: 'ar',
          user: user ?? undefined,
          overrideAccess: false,
        })
      },
    )
    const c = await course()
    const lesson = await makeLesson(payload, c)
    for (const who of ['student'] as const) {
      expect(
        await attempt(() =>
          payload.update({
            collection: 'lessons',
            id: lesson.id,
            data: { durationSeconds: 5 },
            locale: 'ar',
            user: users[who],
            overrideAccess: false,
          }),
        ),
        `edit as ${who}`,
      ).toBe(NO)
      expect(
        await attempt(() =>
          payload.delete({
            collection: 'lessons',
            id: lesson.id,
            user: users[who],
            overrideAccess: false,
          }),
        ),
        `delete as ${who}`,
      ).toBe(NO)
    }
    expect(
      await attempt(() =>
        payload.delete({
          collection: 'lessons',
          id: lesson.id,
          user: users.otherDoctor,
          overrideAccess: false,
        }),
      ),
    ).toBe(YES) // any instructor, not only the one who teaches it
  })

  it('who teaches a course can be changed by the Admin only', async () => {
    const c = await course()
    await attempt(() =>
      payload.update({
        collection: 'courses',
        id: c.id,
        data: { owner: users.otherDoctor.id },
        locale: 'ar',
        user: users.doctor,
        overrideAccess: false,
      }),
    )
    await attempt(() =>
      payload.update({
        collection: 'courses',
        id: c.id,
        data: { owner: users.otherDoctor.id },
        locale: 'ar',
        user: users.otherDoctor,
        overrideAccess: false,
      }),
    )
    expect((await read(c)).owner).toBe(users.doctor.id)
    await payload.update({
      collection: 'courses',
      id: c.id,
      data: { owner: users.otherDoctor.id },
      locale: 'ar',
      user: users.owner,
      overrideAccess: false,
    })
    expect((await read(c)).owner).toBe(users.otherDoctor.id)
  })

  it('the one who teaches a course must be an instructor account', async () => {
    const c = await course()
    expect(
      await attempt(() =>
        payload.update({
          collection: 'courses',
          id: c.id,
          data: { owner: users.student.id },
          locale: 'ar',
          user: users.owner,
          overrideAccess: false,
        }),
      ),
    ).toBe('COURSE_OWNER_INVALID')
  })

  it('the Admin and instructors can change the price at any time; a student cannot', async () => {
    const live = await course({ status: 'published', price: 1000 })
    await payload.update({
      collection: 'courses',
      id: live.id,
      data: { price: 1500 },
      locale: 'ar',
      user: users.otherDoctor,
      overrideAccess: false,
    })
    expect((await read(live)).price).toBe(1500)
    await attempt(() =>
      payload.update({
        collection: 'courses',
        id: live.id,
        data: { price: 1 },
        locale: 'ar',
        user: users.student,
        overrideAccess: false,
      }),
    )
    expect((await read(live)).price).toBe(1500)
  })

  it('drafts are invisible to students and guests, and visible to the Admin and every instructor', async () => {
    const draft = await course({ status: 'draft' })
    const visible = async (user: User | null) =>
      (
        await payload.find({
          collection: 'courses',
          where: { id: { equals: draft.id } },
          user: user ?? undefined,
          overrideAccess: false,
        })
      ).totalDocs === 1
    expect(await visible(users.owner)).toBe(true)
    expect(await visible(users.doctor)).toBe(true)
    expect(await visible(users.otherDoctor)).toBe(true)
    expect(await visible(users.student)).toBe(false)
    expect(await visible(null)).toBe(false)
  })
})

describe('Read orders', () => {
  it('the Admin and instructors read all; a student reads only their own; a guest none', async () => {
    const studentA = await makeUser(payload, 'student')
    const studentB = await makeUser(payload, 'student')
    const c = await course()
    const a = await makeAwaitingReview(payload, studentA, c)
    const b = await makeAwaitingReview(payload, studentB, c)
    const idsFor = async (user: User | null) =>
      (
        await payload.find({
          collection: 'orders',
          where: { id: { in: [a.id, b.id] } },
          user: user ?? undefined,
          overrideAccess: false,
        })
      ).docs
        .map((order) => order.id)
        .sort()

    expect(await idsFor(users.owner)).toEqual([a.id, b.id].sort())
    expect(await idsFor(users.otherDoctor)).toEqual([a.id, b.id].sort())
    expect(await idsFor(studentA)).toEqual([a.id])
    expect(await idsFor(studentB)).toEqual([b.id])
    expect(await idsFor(users.doctor)).toEqual([a.id, b.id].sort())
    expect(await attempt(() => idsFor(null))).toBe(NO)
    // reading someone else's order directly
    expect(
      await attempt(() =>
        payload.findByID({ collection: 'orders', id: b.id, user: studentA, overrideAccess: false }),
      ),
    ).toBe(NO)
  })

  it("a student never sees the Admin's share of their order; the Admin and instructors do", async () => {
    const buyer = await makeUser(payload, 'student')
    const order = await makeAwaitingReview(payload, buyer, await course())
    const seenBy = (user: User) =>
      payload.findByID({ collection: 'orders', id: order.id, user, overrideAccess: false })
    expect(await seenBy(buyer)).not.toHaveProperty('adminAmount')
    expect((await seenBy(users.otherDoctor)).adminAmount).toBe(order.adminAmount)
    expect((await seenBy(users.owner)).adminAmount).toBe(order.adminAmount)
  })
})

describe('Read the revenue and the payments to the Admin', () => {
  it('the revenue: the same for the Admin and every instructor, none for students and guests', async () => {
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      async (_who, user) => {
        if (!user) throw new AppError('UNAUTHENTICATED')
        return getAcademyRevenue(user)
      },
    )
  })

  it('payment records: the Admin and instructors read all; others read none', async () => {
    const payment = await recordAdminPayment({
      amount: 111,
      req: await requestFor(payload, users.doctor),
    })
    await matrix(
      { owner: YES, doctor: YES, otherDoctor: YES, student: NO, guest: NO },
      (_who, user) =>
        payload.findByID({
          collection: 'admin-payments',
          id: payment.id,
          user: user ?? undefined,
          overrideAccess: false,
        }),
    )
  })

  it('payment records cannot be created, edited, or deleted through the generic API, by anyone', async () => {
    const payment = await recordAdminPayment({
      amount: 5,
      req: await requestFor(payload, users.owner),
    })
    for (const who of WHO) {
      const user = asUser(who) ?? undefined
      expect(
        await attempt(() =>
          payload.create({
            collection: 'admin-payments',
            data: { amount: 1, paidAt: new Date().toISOString(), recordedBy: users.owner.id },
            user,
            overrideAccess: false,
          }),
        ),
        `create as ${who}`,
      ).toBe(NO)
      expect(
        await attempt(() =>
          payload.update({
            collection: 'admin-payments',
            id: payment.id,
            data: { amount: 1 },
            user,
            overrideAccess: false,
          }),
        ),
        `update as ${who}`,
      ).toBe(NO)
      expect(
        await attempt(() =>
          payload.delete({
            collection: 'admin-payments',
            id: payment.id,
            user,
            overrideAccess: false,
          }),
        ),
        `delete as ${who}`,
      ).toBe(NO)
    }
  })
})

describe('Manage categories', () => {
  it('creating, editing, and deleting are for the Admin and instructors; students only read', async () => {
    const expected: Expected = {
      owner: YES,
      doctor: YES,
      otherDoctor: YES,
      student: NO,
      guest: NO,
    }
    await matrix(expected, (_who, user) =>
      payload.create({
        collection: 'categories',
        data: { title: unique('cat') },
        locale: 'ar',
        user: user ?? undefined,
        overrideAccess: false,
      }),
    )
    await matrix(expected, async (_who, user) => {
      const category = await makeCategory(payload)
      return payload.update({
        collection: 'categories',
        id: category.id,
        data: { title: 'renamed' },
        locale: 'ar',
        user: user ?? undefined,
        overrideAccess: false,
      })
    })
    await matrix(expected, async (_who, user) => {
      const category = await makeCategory(payload)
      return payload.delete({
        collection: 'categories',
        id: category.id,
        user: user ?? undefined,
        overrideAccess: false,
      })
    })
  })

  it('everyone, even a guest, can read them', async () => {
    const category = await makeCategory(payload)
    for (const who of WHO) {
      expect(
        await attempt(() =>
          payload.findByID({
            collection: 'categories',
            id: category.id,
            user: asUser(who) ?? undefined,
            overrideAccess: false,
          }),
        ),
        who,
      ).toBe(YES)
    }
  })

  it('there are two levels at most, and a category in use cannot be deleted', async () => {
    const top = await makeCategory(payload)
    const sub = await makeCategory(payload, top)
    expect(await attempt(() => makeCategory(payload, sub))).toBe('CATEGORY_TOO_DEEP')
    expect(
      await attempt(() =>
        payload.delete({ collection: 'categories', id: top.id, overrideAccess: true }),
      ),
    ).toBe('CATEGORY_IN_USE')
    const c = await course()
    await payload.update({
      collection: 'courses',
      id: c.id,
      data: { category: sub.id },
      locale: 'ar',
      overrideAccess: true,
    })
    expect(
      await attempt(() =>
        payload.delete({ collection: 'categories', id: sub.id, overrideAccess: true }),
      ),
    ).toBe('CATEGORY_IN_USE')
  })
})
