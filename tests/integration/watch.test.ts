import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getWatchPage, type WatchPage } from '@/lib/catalog/watch'
import { changeCourseStatus } from '@/lib/courses/changeCourseStatus'
import { canWatchLesson } from '@/lib/enrollments/canWatchLesson'
import { refundOrder } from '@/lib/orders/refunds'
import type { Course, Lesson, User } from '@/payload-types'

import {
  makeCourse,
  makePaidOrder,
  makeUser,
  requestFor,
  setPaymentSettings,
  unique,
} from '../support/factories'
import { startApp, stopApp } from '../support/payload'

// "A lesson's video is readable only with an active enrollment, unless isFreePreview is true."
// Three lessons in two modules:  [preview, locked] in module 1, [locked] in module 2.
const IDS = { preview: 'PREVIEWvid01', second: 'SECRETvid002', third: 'SECRETvid003' }

let payload: Payload
let owner: User
let staff: User
let doctor: User
let otherDoctor: User
let enrolled: User
let refunded: User
let stranger: User
let course: Course
let lessons: { preview: Lesson; second: Lesson; third: Lesson }

async function build(status: Course['status'] = 'published') {
  const c = await makeCourse(payload, doctor, { status })
  const make = async (moduleId: string, position: number, videoId: string, free: boolean) =>
    payload.create({
      collection: 'lessons',
      data: {
        title: unique('lesson'),
        module: moduleId,
        position,
        videoProvider: 'youtube',
        videoId,
        durationSeconds: 60,
        isFreePreview: free,
      },
      locale: 'ar',
      overrideAccess: true,
    })
  const m1 = await payload.create({
    collection: 'modules',
    data: { title: 'm1', course: c.id, position: 1 },
    locale: 'ar',
    overrideAccess: true,
  })
  const m2 = await payload.create({
    collection: 'modules',
    data: { title: 'm2', course: c.id, position: 2 },
    locale: 'ar',
    overrideAccess: true,
  })
  return {
    course: c,
    lessons: {
      preview: await make(m1.id, 1, IDS.preview, true),
      second: await make(m1.id, 2, IDS.second, false),
      third: await make(m2.id, 1, IDS.third, false),
    },
  }
}

const page = (c: Course, lesson: Lesson, user: User | null): Promise<WatchPage> =>
  getWatchPage(c.slug ?? '', lesson.id, user, 'en')
const videoIdsIn = (value: unknown) =>
  Object.values(IDS).filter((id) => JSON.stringify(value).includes(id))

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  owner = await makeUser(payload, 'superadmin')
  staff = await makeUser(payload, 'admin', 'staff')
  doctor = await makeUser(payload, 'admin')
  otherDoctor = await makeUser(payload, 'admin')
  enrolled = await makeUser(payload, 'student')
  refunded = await makeUser(payload, 'student')
  stranger = await makeUser(payload, 'student')
  ;({ course, lessons } = await build())
  await makePaidOrder(payload, enrolled, course, staff)
  const gone = await makePaidOrder(payload, refunded, course, staff)
  await refundOrder(gone.id, await requestFor(payload, staff))
})
afterAll(() => stopApp(payload))

describe('who can watch which lesson', () => {
  it('anyone, even a guest, can watch the free preview', async () => {
    for (const user of [null, stranger, refunded, otherDoctor]) {
      const result = await page(course, lessons.preview, user)
      expect(result.kind).toBe('ok')
      if (result.kind === 'ok') expect(result.embedUrl).toContain(IDS.preview)
    }
  })

  it('locks the other lessons for a guest, a student without the course, and a refunded student', async () => {
    for (const user of [null, stranger, refunded]) {
      for (const lesson of [lessons.second, lessons.third]) {
        const result = await page(course, lesson, user)
        expect(result.kind, user?.email ?? 'guest').toBe('locked')
      }
    }
  })

  it('opens every lesson for the enrolled student, every instructor (not only the one who teaches it), and the Admin', async () => {
    for (const user of [enrolled, doctor, otherDoctor, staff, owner]) {
      for (const [key, lesson] of Object.entries(lessons)) {
        const result = await page(course, lesson, user)
        expect(result.kind, `${user.role} ${key}`).toBe('ok')
        if (result.kind === 'ok') expect(result.embedUrl).toContain(IDS[key as keyof typeof IDS])
      }
    }
  })

  it('tells a locked guest to log in, and a locked student just to buy', async () => {
    const guest = await page(course, lessons.second, null)
    const student = await page(course, lessons.second, stranger)
    expect(guest).toMatchObject({ kind: 'locked', loggedIn: false })
    expect(student).toMatchObject({ kind: 'locked', loggedIn: true })
  })

  it('takes access away at once when the student is refunded, and gives it back on a new purchase', async () => {
    const buyer = await makeUser(payload, 'student')
    const order = await makePaidOrder(payload, buyer, course, staff)
    expect((await page(course, lessons.second, buyer)).kind).toBe('ok')
    await refundOrder(order.id, await requestFor(payload, staff))
    expect((await page(course, lessons.second, buyer)).kind).toBe('locked')
    await makePaidOrder(payload, buyer, course, staff)
    expect((await page(course, lessons.second, buyer)).kind).toBe('ok')
  })

  it('agrees with canWatchLesson, the one-call version of the rule', async () => {
    expect(await canWatchLesson(lessons.preview, course, null, payload)).toBe(true)
    expect(await canWatchLesson(lessons.second, course, null, payload)).toBe(false)
    expect(await canWatchLesson(lessons.second, course, enrolled, payload)).toBe(true)
    expect(await canWatchLesson(lessons.second, course, stranger, payload)).toBe(false)
    expect(await canWatchLesson(lessons.second, course, otherDoctor, payload)).toBe(true)
  })
})

describe('the video is never exposed to someone who may not watch', () => {
  it("a locked page carries no video id at all, not even another lesson's", async () => {
    for (const user of [null, stranger, refunded]) {
      const result = await page(course, lessons.second, user)
      expect(videoIdsIn(result), user?.email ?? 'guest').toEqual([])
    }
  })

  it("an unlocked page carries only that lesson's video", async () => {
    const result = await page(course, lessons.second, enrolled)
    expect(videoIdsIn(result)).toEqual([IDS.second])
  })

  it('the lesson API hides the video id and provider from everyone but the Admin and instructors', async () => {
    const read = async (user: User | null) => {
      const { docs } = await payload.find({
        collection: 'lessons',
        where: { course: { equals: course.id } },
        depth: 0,
        user: user ?? undefined,
        overrideAccess: false,
      })
      return docs
    }
    for (const user of [null, stranger, enrolled, refunded]) {
      const docs = await read(user)
      expect(docs.length, user?.email ?? 'guest').toBe(3) // they can see the outline...
      for (const doc of docs) {
        expect(doc, user?.email ?? 'guest').not.toHaveProperty('videoId') // ...but never the video
        expect(doc).not.toHaveProperty('videoProvider')
      }
    }
    for (const user of [doctor, otherDoctor, staff, owner]) {
      const docs = await read(user)
      expect(docs.map((doc) => doc.videoId).sort()).toEqual(Object.values(IDS).sort())
    }
  })

  it('even an enrolled student cannot read a video id through the API: only the server turns it into a player', async () => {
    const doc = await payload.findByID({
      collection: 'lessons',
      id: lessons.second.id,
      depth: 2,
      user: enrolled,
      overrideAccess: false,
    })
    expect(JSON.stringify(doc)).not.toContain(IDS.second)
  })
})

describe('courses that are not public', () => {
  it('a draft course does not exist for a guest or a student, even for its free preview', async () => {
    const draft = await build('draft')
    for (const user of [null, stranger]) {
      expect(
        (await page(draft.course, draft.lessons.preview, user)).kind,
        user?.email ?? 'guest',
      ).toBe('notFound')
    }
  })

  it('...but the Admin and every instructor can preview it', async () => {
    const draft = await build('draft')
    for (const user of [doctor, otherDoctor, staff, owner]) {
      expect((await page(draft.course, draft.lessons.second, user)).kind, user.role).toBe('ok')
    }
  })

  it('an archived course keeps its students, and disappears for everyone else', async () => {
    const live = await build('published')
    const buyer = await makeUser(payload, 'student')
    await makePaidOrder(payload, buyer, live.course, staff)
    const left = await makeUser(payload, 'student')
    const leftOrder = await makePaidOrder(payload, left, live.course, staff)
    await refundOrder(leftOrder.id, await requestFor(payload, staff))

    await changeCourseStatus({
      courseId: live.course.id,
      to: 'archived',
      req: await requestFor(payload, staff),
    })

    expect((await page(live.course, live.lessons.second, buyer)).kind).toBe('ok')
    expect((await page(live.course, live.lessons.preview, null)).kind).toBe('notFound')
    expect((await page(live.course, live.lessons.preview, stranger)).kind).toBe('notFound')
    expect((await page(live.course, live.lessons.second, left)).kind).toBe('notFound')
  })
})

describe('wrong ids', () => {
  it('says not found for an unknown course, an unknown lesson, or a lesson from a different course', async () => {
    expect((await getWatchPage('no-such-course', lessons.preview.id, owner, 'en')).kind).toBe(
      'notFound',
    )
    expect(
      (await getWatchPage(course.slug ?? '', '00000000-0000-0000-0000-000000000000', owner, 'en'))
        .kind,
    ).toBe('notFound')
    const other = await build()
    expect(
      (await getWatchPage(course.slug ?? '', other.lessons.preview.id, owner, 'en')).kind,
    ).toBe('notFound')
  })

  it("knows each lesson's place in the course, for the previous and next buttons", async () => {
    const result = await page(course, lessons.second, enrolled)
    if (result.kind !== 'ok') throw new Error('expected an unlocked page')
    expect(result.position).toEqual({ number: 2, total: 3 })
    expect(result.previous?.id).toBe(lessons.preview.id)
    expect(result.next?.id).toBe(lessons.third.id)
    const first = await page(course, lessons.preview, enrolled)
    expect(first.kind === 'ok' && first.previous).toBeNull()
    const last = await page(course, lessons.third, enrolled)
    expect(last.kind === 'ok' && last.next).toBeNull()
  })

  it('marks which lessons a guest may open, so locked ones are not links', async () => {
    const result = await page(course, lessons.preview, null)
    if (result.kind !== 'ok') throw new Error('expected the preview to open')
    const flat = result.modules.flatMap((courseModule) => courseModule.lessons)
    expect(flat.map((lesson) => lesson.watchable)).toEqual([true, false, false])
  })
})
