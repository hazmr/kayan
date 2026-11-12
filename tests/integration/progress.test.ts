import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { relationId } from '@/collections/shared/relationId'
import { getWatchPage } from '@/lib/catalog/watch'
import { listMyCourses } from '@/lib/enrollments/myCourses'
import { refundOrder } from '@/lib/orders/refunds'
import { setLessonCompleted } from '@/lib/progress/progress'
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

// "Lesson progress": a student who owns a course marks lessons complete and sees how far they are.

let payload: Payload
let manager: User
let doctor: User
let student: User
let otherStudent: User
let stranger: User
let course: Course
let lessons: Lesson[]

async function addLessons(target: Course, count: number): Promise<Lesson[]> {
  const courseModule = await payload.create({
    collection: 'modules',
    data: { title: unique('module'), course: target.id, position: 1 },
    locale: 'ar',
    overrideAccess: true,
  })
  const made: Lesson[] = []
  for (let position = 1; position <= count; position++) {
    made.push(
      await payload.create({
        collection: 'lessons',
        data: {
          title: unique('lesson'),
          module: courseModule.id,
          position,
          videoProvider: 'youtube',
          videoId: `lessonvid0${position}`,
          durationSeconds: 60,
          isFreePreview: position === 1,
        },
        locale: 'ar',
        overrideAccess: true,
      }),
    )
  }
  return made
}

const mark = async (who: User | null, lesson: Lesson, completed = true) =>
  setLessonCompleted({
    lessonId: lesson.id,
    completed,
    req: await requestFor(payload, who),
  })

const rows = async (who: User) =>
  (
    await payload.find({
      collection: 'lesson-progress',
      where: { user: { equals: who.id } },
      pagination: false,
      overrideAccess: true,
    })
  ).docs

const myCourse = async (who: User, target = course) =>
  (await listMyCourses(who, 'ar')).find((item) => item.id === target.id)!

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  manager = await makeUser(payload, 'manager')
  doctor = await makeUser(payload, 'admin')
  student = await makeUser(payload, 'student')
  otherStudent = await makeUser(payload, 'student')
  stranger = await makeUser(payload, 'student')
  course = await makeCourse(payload, doctor, { price: 40000 })
  lessons = await addLessons(course, 4)
  await makePaidOrder(payload, student, course, manager)
  await makePaidOrder(payload, otherStudent, course, manager)
})
afterAll(() => stopApp(payload))

describe('completing lessons', () => {
  it('starts at 0 and says "start learning" at the first lesson', async () => {
    const before = await myCourse(student)
    expect(before.progress).toEqual({ completed: 0, total: 4, percent: 0 })
    expect(before.learnState).toBe('start')
    expect(before.resumeLessonId).toBe(lessons[0]!.id)
  })

  it('counts lessons as they are completed and continues at the first one not done', async () => {
    await mark(student, lessons[0]!)
    await mark(student, lessons[1]!)
    const now = await myCourse(student)
    expect(now.progress).toEqual({ completed: 2, total: 4, percent: 50 })
    expect(now.learnState).toBe('continue')
    expect(now.resumeLessonId).toBe(lessons[2]!.id)
  })

  it('is safe to repeat: completing twice leaves one row, undoing twice is fine', async () => {
    await mark(student, lessons[2]!)
    await mark(student, lessons[2]!)
    expect(
      (await rows(student)).filter((row) => relationId(row.lesson) === lessons[2]!.id),
    ).toHaveLength(1)

    await mark(student, lessons[2]!, false)
    await mark(student, lessons[2]!, false)
    expect((await myCourse(student)).progress.completed).toBe(2)
  })

  it('six clicks at the same moment still leave one row', async () => {
    await Promise.all(Array.from({ length: 6 }, () => mark(student, lessons[3]!)))
    expect(
      (await rows(student)).filter((row) => relationId(row.lesson) === lessons[3]!.id),
    ).toHaveLength(1)
  })

  it('offers a review once every lesson is done', async () => {
    await mark(student, lessons[2]!)
    const done = await myCourse(student)
    expect(done.progress).toEqual({ completed: 4, total: 4, percent: 100 })
    expect(done.learnState).toBe('review')
    expect(done.resumeLessonId).toBe(lessons[0]!.id)
    await mark(student, lessons[3]!, false) // leave the shared student at 3 of 4 for later tests
    await mark(student, lessons[2]!, false)
  })

  it("keeps each student's progress apart", async () => {
    expect((await myCourse(otherStudent)).progress.completed).toBe(0)
    await mark(otherStudent, lessons[0]!)
    expect((await myCourse(otherStudent)).progress.completed).toBe(1)
    expect((await myCourse(student)).progress.completed).toBe(2)
    await mark(otherStudent, lessons[0]!, false)
  })
})

describe('who may track progress', () => {
  it('refuses a student who has not bought the course', async () => {
    await expect(mark(stranger, lessons[1]!)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await rows(stranger)).toEqual([])
  })

  it('refuses a guest, the course doctor, and staff', async () => {
    await expect(mark(null, lessons[1]!)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await expect(mark(doctor, lessons[1]!)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(mark(manager, lessons[1]!)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('refuses a student whose purchase was refunded', async () => {
    const refundedStudent = await makeUser(payload, 'student')
    const order = await makePaidOrder(payload, refundedStudent, course, manager)
    await mark(refundedStudent, lessons[0]!)
    await refundOrder(order.id, await requestFor(payload, manager))
    await expect(mark(refundedStudent, lessons[1]!)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // and the course is gone from their list, as before
    expect((await listMyCourses(refundedStudent, 'ar')).some((item) => item.id === course.id)).toBe(
      false,
    )
  })

  it('answers "not found" for a lesson that does not exist', async () => {
    await expect(
      setLessonCompleted({
        lessonId: '00000000-0000-4000-8000-000000000000',
        completed: true,
        req: await requestFor(payload, student),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it("nobody reads another person's progress through the API, staff included", async () => {
    const seenBy = async (user: User) =>
      (
        await payload.find({
          collection: 'lesson-progress',
          where: { user: { equals: student.id } },
          user,
          overrideAccess: false,
        })
      ).docs.length
    expect(await seenBy(student)).toBeGreaterThan(0)
    expect(await seenBy(otherStudent)).toBe(0)
    expect(await seenBy(manager)).toBe(0)
    expect(await seenBy(doctor)).toBe(0)
  })

  it('cannot be written through the generic API', async () => {
    await expect(
      payload.create({
        collection: 'lesson-progress',
        data: {
          user: stranger.id,
          course: course.id,
          lesson: lessons[0]!.id,
          completedAt: new Date().toISOString(),
        },
        user: stranger,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})

describe('on the lesson page', () => {
  it('marks only a student who owns the course as able to track, and lists what they completed', async () => {
    const asStudent = await getWatchPage(course.slug!, lessons[1]!.id, student, 'ar')
    expect(asStudent.kind).toBe('ok')
    if (asStudent.kind !== 'ok') return
    expect(asStudent.progress.trackable).toBe(true)
    expect(new Set(asStudent.progress.completedIds)).toEqual(
      new Set([lessons[0]!.id, lessons[1]!.id]),
    )

    for (const viewer of [doctor, manager, null]) {
      const page = await getWatchPage(course.slug!, lessons[0]!.id, viewer, 'ar')
      if (page.kind === 'notFound') throw new Error('expected a page')
      expect(page.progress, viewer?.role ?? 'guest').toEqual({ trackable: false, completedIds: [] })
    }
    const asStranger = await getWatchPage(course.slug!, lessons[0]!.id, stranger, 'ar')
    if (asStranger.kind === 'notFound') throw new Error('expected a page')
    expect(asStranger.progress.trackable).toBe(false)
  })
})

describe('when the doctor changes the course', () => {
  it('deleting a lesson removes its marks, and the percentage stays within 100', async () => {
    const own = await makeCourse(payload, doctor, { price: 40000 })
    const two = await addLessons(own, 2)
    const buyer = await makeUser(payload, 'student')
    await makePaidOrder(payload, buyer, own, manager)
    await mark(buyer, two[0]!)
    await mark(buyer, two[1]!)
    expect((await myCourse(buyer, own)).progress.percent).toBe(100)

    await payload.delete({ collection: 'lessons', id: two[1]!.id, overrideAccess: true })
    const after = await myCourse(buyer, own)
    expect(after.progress).toEqual({ completed: 1, total: 1, percent: 100 })
    expect(await rows(buyer)).toHaveLength(1)
  })
})
