// One block per row of the access table in the project brief, in the same order, followed by the
// rules listed under it. Each row is tried as an owner (superadmin), a manager, the course's
// doctor, another doctor, a student, and a guest.
import type { Endpoint, Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Users } from '@/collections/Users'
import { changeCourseStatus } from '@/lib/courses/changeCourseStatus'
import { getOwnerEarnings } from '@/lib/earnings/getOwnerEarnings'
import { recordPayout } from '@/lib/earnings/payouts'
import { AppError } from '@/lib/errors/AppError'
import { listSalesForDoctor } from '@/lib/dashboard/orderQueries'
import { declineRefund, refundOrder, requestRefund } from '@/lib/orders/refunds'
import { approveReceipt, rejectReceipt } from '@/lib/orders/reviewReceipt'
import { confirmOwnerPromotion } from '@/lib/users/ownerPromotion'
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
import { emails, startApp, stopApp } from '../support/payload'

type Who = 'owner' | 'manager' | 'doctor' | 'otherDoctor' | 'student' | 'guest'
const WHO: Who[] = ['owner', 'manager', 'doctor', 'otherDoctor', 'student', 'guest']
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
    manager: await makeUser(payload, 'manager'),
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
  it('is for the owner only', async () => {
    await matrix(
      { owner: YES, manager: NO, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
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

  it('can be read by staff only', async () => {
    await matrix(
      { owner: YES, manager: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
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
      { owner: YES, manager: NO, doctor: NO, otherDoctor: NO, student: NO, guest: YES },
      (_who, user) =>
        payload.create({
          collection: 'users',
          data: {
            name: 'New',
            email: `${unique('new')}@vetudy.test`,
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
        email: `${unique('sneaky')}@vetudy.test`,
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

  it('the owner can create staff and doctors directly, but never another owner (that takes two steps)', async () => {
    for (const role of ['manager', 'admin', 'student'] as const) {
      const created = await payload.create({
        collection: 'users',
        data: { name: role, email: `${unique(role)}@vetudy.test`, password: PASSWORD, role },
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
            email: `${unique('x')}@vetudy.test`,
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
      { owner: YES, manager: NO, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const target = await makeUser(payload, 'student')
        return callUserEndpoint('/:id/role', user, target.id, {
          role: 'manager',
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
          role: 'manager',
          password: 'wrong',
        }),
      ),
    ).toBe('WRONG_PASSWORD')
    expect(
      await attempt(() =>
        callUserEndpoint('/:id/role', users.owner, target.id, { role: 'manager' }),
      ),
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
    for (const user of [users.owner, users.manager, target]) {
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

  it('making someone an owner needs an emailed link that only the requesting owner can use', async () => {
    const target = await makeUser(payload, 'manager')
    emails.reset()
    const response = await callUserEndpoint('/:id/role', users.owner, target.id, {
      role: 'superadmin',
      password: PASSWORD,
    })
    expect(await response.json()).toMatchObject({ pending: true })
    expect(
      (await payload.findByID({ collection: 'users', id: target.id, overrideAccess: true })).role,
    ).toBe('manager') // not yet

    const mail = emails.withSubject('Confirm a new owner')
    expect(mail).toHaveLength(1)
    expect(mail[0]?.to).toBe(users.owner.email) // goes to the owner who asked, not the new owner
    const token = /token=([0-9a-f]{64})/.exec(mail[0]!.html)?.[1]
    expect(token).toBeTruthy()

    const anotherOwner = await makeUser(payload, 'superadmin')
    expect(
      await attempt(async () =>
        confirmOwnerPromotion(token!, await requestFor(payload, anotherOwner)),
      ),
    ).toBe('INVALID_TOKEN')
    expect(
      await attempt(async () =>
        confirmOwnerPromotion(token!, await requestFor(payload, users.manager)),
      ),
    ).toBe('INVALID_TOKEN')
    expect(
      await attempt(async () =>
        confirmOwnerPromotion('0'.repeat(64), await requestFor(payload, users.owner)),
      ),
    ).toBe('INVALID_TOKEN')
    expect(
      (await payload.findByID({ collection: 'users', id: target.id, overrideAccess: true })).role,
    ).toBe('manager')

    await confirmOwnerPromotion(token!, await requestFor(payload, users.owner))
    expect(
      (await payload.findByID({ collection: 'users', id: target.id, overrideAccess: true })).role,
    ).toBe('superadmin')
    expect(
      await attempt(async () =>
        confirmOwnerPromotion(token!, await requestFor(payload, users.owner)),
      ),
    ).toBe('INVALID_TOKEN') // one use only
  })
})

describe('Delete courses or users', () => {
  it('deleting a course is for the owner only', async () => {
    await matrix(
      { owner: YES, manager: NO, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
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
    await makePaidOrder(payload, await makeUser(payload, 'student'), c, users.manager)
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
      req: await requestFor(payload, users.manager),
    })
    expect((await read(c)).status).toBe('archived')
  })

  it('deleting a user is for the owner only, through the password-confirmed endpoint', async () => {
    await matrix(
      { owner: YES, manager: NO, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
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

describe('Set ownerSharePercent', () => {
  it('is settable by the owner only: when others try, the platform default is used', async () => {
    for (const who of ['owner', 'manager', 'doctor'] as const) {
      const created = await payload.create({
        collection: 'courses',
        data: {
          title: unique('share'),
          description: 'x',
          price: 1000,
          ownerSharePercent: 95,
          owner: users.doctor.id,
          status: 'draft',
        },
        locale: 'ar',
        user: users[who],
        overrideAccess: false,
      })
      // Read it back in full: a manager is not even allowed to see this field in the response.
      const stored = await payload.findByID({
        collection: 'courses',
        id: created.id,
        overrideAccess: true,
      })
      expect(stored.ownerSharePercent, `created by ${who}`).toBe(who === 'owner' ? 95 : 70)
    }
  })

  it('cannot be changed later by a manager or the doctor, but can by the owner', async () => {
    const c = await course({ sharePercent: 70 })
    for (const who of ['manager', 'doctor'] as const) {
      await attempt(() =>
        payload.update({
          collection: 'courses',
          id: c.id,
          data: { ownerSharePercent: 100 },
          locale: 'ar',
          user: users[who],
          overrideAccess: false,
        }),
      )
      expect((await read(c)).ownerSharePercent, `after ${who} tried`).toBe(70)
    }
    await payload.update({
      collection: 'courses',
      id: c.id,
      data: { ownerSharePercent: 60 },
      locale: 'ar',
      user: users.owner,
      overrideAccess: false,
    })
    expect((await read(c)).ownerSharePercent).toBe(60)
  })

  it('the default share is a setting only the owner can read or change', async () => {
    await matrix(
      { owner: YES, manager: NO, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      (_who, user) =>
        payload.updateGlobal({
          slug: 'platform-settings',
          data: { defaultOwnerSharePercent: 70 },
          user: user ?? undefined,
          overrideAccess: false,
        }),
    )
  })
})

describe('Record payouts', () => {
  it('is for the owner only', async () => {
    await matrix(
      { owner: YES, manager: NO, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) =>
        recordPayout({
          doctorId: users.doctor.id,
          amount: 100,
          req: await requestFor(payload, user),
        }),
    )
  })
})

describe('Approve or reject receipts', () => {
  it('approving is for the owner and managers', async () => {
    await matrix(
      { owner: YES, manager: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
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

  it('rejecting is for the owner and managers', async () => {
    await matrix(
      { owner: YES, manager: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
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
  it('marking an order refunded is for the owner and managers', async () => {
    await matrix(
      { owner: YES, manager: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const paid = await makePaidOrder(
          payload,
          await makeUser(payload, 'student'),
          await course(),
          users.manager,
        )
        return refundOrder(paid.id, await requestFor(payload, user))
      },
    )
  })

  it('declining a refund request is for the owner and managers', async () => {
    await matrix(
      { owner: YES, manager: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const buyer = await makeUser(payload, 'student')
        const paid = await makePaidOrder(payload, buyer, await course(), users.manager)
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
  it("is for the owner and managers; the course's own doctor cannot publish", async () => {
    await matrix(
      { owner: YES, manager: YES, doctor: NO, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const c = await course({ status: 'in_review' })
        return changeCourseStatus({
          courseId: c.id,
          to: 'published',
          req: await requestFor(payload, user),
        })
      },
    )
  })

  it("a doctor moves their OWN draft to review: not another doctor's, and a student cannot", async () => {
    await matrix(
      { owner: YES, manager: YES, doctor: YES, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        const c = await course({ status: 'draft' })
        await completeCourse(c)
        return changeCourseStatus({
          courseId: c.id,
          to: 'in_review',
          req: await requestFor(payload, user),
        })
      },
    )
  })

  it('a course goes live only through review: draft cannot jump to published', async () => {
    const c = await course({ status: 'draft' })
    expect(
      await attempt(async () =>
        changeCourseStatus({
          courseId: c.id,
          to: 'published',
          req: await requestFor(payload, users.owner),
        }),
      ),
    ).toBe('COURSE_INVALID_STATE')
  })

  it('archiving and un-archiving are for the owner and managers', async () => {
    const live = await course({ status: 'published' })
    expect(
      await attempt(async () =>
        changeCourseStatus({
          courseId: live.id,
          to: 'archived',
          req: await requestFor(payload, users.doctor),
        }),
      ),
    ).toBe(NO)
    await changeCourseStatus({
      courseId: live.id,
      to: 'archived',
      req: await requestFor(payload, users.manager),
    })
    expect(
      await attempt(async () =>
        changeCourseStatus({
          courseId: live.id,
          to: 'published',
          req: await requestFor(payload, users.doctor),
        }),
      ),
    ).toBe(NO)
    await changeCourseStatus({
      courseId: live.id,
      to: 'published',
      req: await requestFor(payload, users.owner),
    })
  })

  it('a doctor cannot send an unfinished course for review', async () => {
    const c = await course({ status: 'draft' }) // no category, thumbnail, or lesson
    expect(
      await attempt(async () =>
        changeCourseStatus({
          courseId: c.id,
          to: 'in_review',
          req: await requestFor(payload, users.doctor),
        }),
      ),
    ).toBe('COURSE_INCOMPLETE')
  })

  it('sending back needs a note', async () => {
    const c = await course({ status: 'in_review' })
    expect(
      await attempt(async () =>
        changeCourseStatus({
          courseId: c.id,
          to: 'draft',
          req: await requestFor(payload, users.manager),
        }),
      ),
    ).toBe('REVIEW_NOTE_REQUIRED')
    await changeCourseStatus({
      courseId: c.id,
      to: 'draft',
      note: 'add a description',
      req: await requestFor(payload, users.manager),
    })
    expect((await read(c)).reviewNote).toBe('add a description')
  })

  it('the status field itself is closed: nobody can set it by editing the course', async () => {
    const c = await course({ status: 'draft' })
    for (const who of ['owner', 'manager', 'doctor'] as const) {
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

/** Gives a draft the category, thumbnail and lesson that review requires. */
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
  it('courses: all for the owner and managers, only their own for a doctor, none for a student', async () => {
    await matrix(
      { owner: YES, manager: YES, doctor: YES, otherDoctor: NO, student: NO, guest: NO },
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
      { owner: YES, manager: YES, doctor: YES, otherDoctor: NO, student: NO, guest: NO },
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
      { owner: YES, manager: YES, doctor: YES, otherDoctor: NO, student: NO, guest: NO },
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
    for (const who of ['otherDoctor', 'student'] as const) {
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
          user: users.doctor,
          overrideAccess: false,
        }),
      ),
    ).toBe(YES)
  })

  it("a doctor cannot move a module into someone else's course", async () => {
    const mine = await course()
    const theirs = await makeCourse(payload, users.otherDoctor)
    const m = await payload.create({
      collection: 'modules',
      data: { title: 'm', course: mine.id, position: 1 },
      locale: 'ar',
      overrideAccess: true,
    })
    expect(
      await attempt(() =>
        payload.update({
          collection: 'modules',
          id: m.id,
          data: { course: theirs.id },
          locale: 'ar',
          user: users.doctor,
          overrideAccess: false,
        }),
      ),
    ).toBe(NO)
  })

  it('the course owner cannot be changed by a doctor, only by the owner', async () => {
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
        user: users.manager,
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

  it('a course owner must be a doctor account', async () => {
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

  it('a doctor sets the price only while the course is a draft; staff can at any time', async () => {
    const draft = await course({ status: 'draft', price: 1000 })
    await payload.update({
      collection: 'courses',
      id: draft.id,
      data: { price: 2000 },
      locale: 'ar',
      user: users.doctor,
      overrideAccess: false,
    })
    expect((await read(draft)).price).toBe(2000)

    const inReview = await course({ status: 'in_review', price: 1000 })
    await attempt(() =>
      payload.update({
        collection: 'courses',
        id: inReview.id,
        data: { price: 9999 },
        locale: 'ar',
        user: users.doctor,
        overrideAccess: false,
      }),
    )
    expect((await read(inReview)).price).toBe(1000) // quietly ignored

    const live = await course({ status: 'published', price: 1000 })
    await attempt(() =>
      payload.update({
        collection: 'courses',
        id: live.id,
        data: { price: 9999 },
        locale: 'ar',
        user: users.doctor,
        overrideAccess: false,
      }),
    )
    expect((await read(live)).price).toBe(1000)
    await payload.update({
      collection: 'courses',
      id: live.id,
      data: { price: 1500 },
      locale: 'ar',
      user: users.manager,
      overrideAccess: false,
    })
    expect((await read(live)).price).toBe(1500)
  })

  it("a doctor's unpublished courses are invisible to everyone but staff and that doctor", async () => {
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
    expect(await visible(users.manager)).toBe(true)
    expect(await visible(users.doctor)).toBe(true)
    expect(await visible(users.otherDoctor)).toBe(false)
    expect(await visible(users.student)).toBe(false)
    expect(await visible(null)).toBe(false)
  })
})

describe('Read orders', () => {
  it('the owner and managers read all; a student reads only their own; a doctor reads none through the API; a guest none', async () => {
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
    expect(await idsFor(users.manager)).toEqual([a.id, b.id].sort())
    expect(await idsFor(studentA)).toEqual([a.id])
    expect(await idsFor(studentB)).toEqual([b.id])
    expect(await idsFor(users.doctor)).toEqual([]) // the doctor of that very course
    expect(await attempt(() => idsFor(null))).toBe(NO)
    // reading someone else's order directly
    expect(
      await attempt(() =>
        payload.findByID({ collection: 'orders', id: b.id, user: studentA, overrideAccess: false }),
      ),
    ).toBe(NO)
  })

  it("a student never sees the doctor's share or who the doctor is", async () => {
    const buyer = await makeUser(payload, 'student')
    const order = await makeAwaitingReview(payload, buyer, await course())
    const seen = await payload.findByID({
      collection: 'orders',
      id: order.id,
      user: buyer,
      overrideAccess: false,
    })
    expect(seen).not.toHaveProperty('ownerAmount')
    expect(seen).not.toHaveProperty('owner')
    // A manager sees what the student paid, but not how the money is split.
    const managerView = await payload.findByID({
      collection: 'orders',
      id: order.id,
      user: users.manager,
      overrideAccess: false,
    })
    expect(managerView.amount).toBe(40000)
    expect(managerView).not.toHaveProperty('ownerAmount')
    expect(managerView).not.toHaveProperty('owner')
    // The owner sees the split.
    const ownerView = await payload.findByID({
      collection: 'orders',
      id: order.id,
      user: users.owner,
      overrideAccess: false,
    })
    expect(ownerView.ownerAmount).toBe(28000)
  })

  it('a doctor reads the sales of their own courses through the sales view, with only name, amount, share, status, and date', async () => {
    const mine = await course()
    const theirs = await makeCourse(payload, users.otherDoctor)
    await makePaidOrder(payload, await makeUser(payload, 'student'), mine, users.manager)
    await makePaidOrder(payload, await makeUser(payload, 'student'), theirs, users.manager)

    const mineRows = await listSalesForDoctor(users.doctor, { page: 1 })
    expect(mineRows.rows.length).toBeGreaterThan(0)
    expect(mineRows.rows.every((row) => row.courseTitle.ar.startsWith('course-'))).toBe(true)
    expect(mineRows.rows.some((row) => row.courseTitle.ar === theirs.title)).toBe(false)
    expect(Object.keys(mineRows.rows[0]!).sort()).toEqual([
      'amountEgp',
      'courseTitle',
      'createdAt',
      'shareEgp',
      'status',
      'studentName',
    ])
    expect(mineRows.rows[0]).toMatchObject({ amountEgp: 400, shareEgp: 280, status: 'paid' })
  })

  it("a doctor's sales view hides orders that are not real sales (not yet paid, rejected, cancelled)", async () => {
    const lonely = await makeUser(payload, 'admin')
    const c = await makeCourse(payload, lonely)
    const buyer = await makeUser(payload, 'student')
    const { startOrder } = await import('@/lib/orders/startOrder')
    await startOrder({ courseId: c.id, method: 'instapay', req: await requestFor(payload, buyer) }) // pending
    expect((await listSalesForDoctor(lonely, { page: 1 })).rows).toEqual([])
    await makeAwaitingReview(payload, await makeUser(payload, 'student'), c)
    expect((await listSalesForDoctor(lonely, { page: 1 })).rows.map((row) => row.status)).toEqual([
      'awaiting_review',
    ])
  })
})

describe('Read earnings and payouts', () => {
  it('earnings: all for the owner, only their own for a doctor, none for managers and students', async () => {
    await matrix(
      { owner: YES, manager: NO, doctor: YES, otherDoctor: NO, student: NO, guest: NO },
      async (_who, user) => {
        if (!user) throw new AppError('UNAUTHENTICATED')
        return getOwnerEarnings(user, users.doctor.id)
      },
    )
  })

  it("a doctor can open their own earnings and not another doctor's", async () => {
    await expect(getOwnerEarnings(users.doctor, users.doctor.id)).resolves.toBeTruthy()
    expect(await attempt(() => getOwnerEarnings(users.doctor, users.otherDoctor.id))).toBe(NO)
    expect(await attempt(() => getOwnerEarnings(users.student, users.student.id))).toBe(NO)
  })

  it('payouts: the owner reads all; a doctor reads only their own; managers and others read none', async () => {
    const mine = await recordPayout({
      doctorId: users.doctor.id,
      amount: 111,
      req: await requestFor(payload, users.owner),
    })
    const theirs = await recordPayout({
      doctorId: users.otherDoctor.id,
      amount: 222,
      req: await requestFor(payload, users.owner),
    })
    const idsFor = async (user: User | null) =>
      (
        await payload.find({
          collection: 'payouts',
          where: { id: { in: [mine.id, theirs.id] } },
          user: user ?? undefined,
          overrideAccess: false,
        })
      ).docs
        .map((payout) => payout.id)
        .sort()

    expect(await idsFor(users.owner)).toEqual([mine.id, theirs.id].sort())
    expect(await attempt(() => idsFor(users.manager))).toBe(NO)
    expect(await idsFor(users.doctor)).toEqual([mine.id])
    expect(await idsFor(users.otherDoctor)).toEqual([theirs.id])
    expect(await attempt(() => idsFor(users.student))).toBe(NO)
    expect(await attempt(() => idsFor(null))).toBe(NO)
  })

  it('payouts cannot be created, edited, or deleted through the generic API, by anyone', async () => {
    const payout = await recordPayout({
      doctorId: users.doctor.id,
      amount: 5,
      req: await requestFor(payload, users.owner),
    })
    for (const who of WHO) {
      const user = asUser(who) ?? undefined
      expect(
        await attempt(() =>
          payload.create({
            collection: 'payouts',
            data: {
              owner: users.doctor.id,
              amount: 1,
              paidAt: new Date().toISOString(),
              paidBy: users.owner.id,
            },
            user,
            overrideAccess: false,
          }),
        ),
        `create as ${who}`,
      ).toBe(NO)
      expect(
        await attempt(() =>
          payload.update({
            collection: 'payouts',
            id: payout.id,
            data: { amount: 1 },
            user,
            overrideAccess: false,
          }),
        ),
        `update as ${who}`,
      ).toBe(NO)
      expect(
        await attempt(() =>
          payload.delete({ collection: 'payouts', id: payout.id, user, overrideAccess: false }),
        ),
        `delete as ${who}`,
      ).toBe(NO)
    }
  })
})

describe('Manage categories', () => {
  it('creating, editing, and deleting are for the owner and managers; doctors and students only read', async () => {
    const expected: Expected = {
      owner: YES,
      manager: YES,
      doctor: NO,
      otherDoctor: NO,
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
