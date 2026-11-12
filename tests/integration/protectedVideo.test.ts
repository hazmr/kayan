import { createHash } from 'node:crypto'

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getWatchPage } from '@/lib/catalog/watch'
import type { Course, Lesson, User } from '@/payload-types'

import {
  makeCourse,
  makePaidOrder,
  makeUser,
  PASSWORD,
  setPaymentSettings,
  unique,
} from '../support/factories'
import { startApp, stopApp } from '../support/payload'

// "Protected video": paid lessons on Bunny Stream are played through signed, expiring links
// that only buyers ever receive, and a student account works on one device at a time.
// The test settings use Bunny library 12345 with the key test-bunny-token-key (tests/support/env.ts).

const BUNNY_VIDEO = '2f1e6c3a-9b0d-4c77-8a1e-5d2b9f6e4a10'

let payload: Payload
let instructor: User
let buyer: User
let stranger: User
let course: Course
let preview: Lesson
let exclusive: Lesson

async function lesson(
  target: Course,
  position: number,
  provider: 'youtube' | 'bunny',
  videoId: string,
  free: boolean,
  moduleId?: string,
): Promise<Lesson> {
  const courseModule =
    moduleId ??
    (
      await payload.create({
        collection: 'modules',
        data: { title: unique('module'), course: target.id, position: 1 },
        locale: 'ar',
        overrideAccess: true,
      })
    ).id
  return payload.create({
    collection: 'lessons',
    data: {
      title: unique('lesson'),
      module: courseModule,
      position,
      videoProvider: provider,
      videoId,
      durationSeconds: 300,
      isFreePreview: free,
    },
    locale: 'ar',
    overrideAccess: true,
  })
}

const pageFor = (target: Lesson, user: User | null) =>
  getWatchPage(course.slug!, target.id, user, 'ar')

beforeAll(async () => {
  payload = await startApp()
  await setPaymentSettings(payload)
  instructor = await makeUser(payload, 'admin')
  buyer = await makeUser(payload, 'student')
  stranger = await makeUser(payload, 'student')
  course = await makeCourse(payload, instructor, { price: 50000 })
  preview = await lesson(course, 1, 'youtube', 'PREVIEWvid01', true)
  exclusive = await lesson(
    course,
    2,
    'bunny',
    BUNNY_VIDEO,
    false,
    typeof preview.module === 'string' ? preview.module : preview.module.id,
  )
  await makePaidOrder(payload, buyer, course, instructor)
})
afterAll(() => stopApp(payload))

describe('a Bunny lesson', () => {
  it('plays for a buyer through a signed Bunny link that expires in a few hours', async () => {
    const before = Math.floor(Date.now() / 1000)
    const page = await pageFor(exclusive, buyer)
    expect(page.kind).toBe('ok')
    if (page.kind !== 'ok') return
    expect(page.protectedVideo).toBe(true)

    const url = new URL(page.embedUrl)
    expect(url.origin + url.pathname).toBe(
      `https://player.mediadelivery.net/embed/12345/${BUNNY_VIDEO}`,
    )
    const expires = Number(url.searchParams.get('expires'))
    expect(expires - before).toBeGreaterThan(3 * 60 * 60)
    expect(expires - before).toBeLessThanOrEqual(4 * 60 * 60 + 5)
    expect(url.searchParams.get('token')).toBe(
      createHash('sha256').update(`test-bunny-token-key${BUNNY_VIDEO}${expires}`).digest('hex'),
    )
  })

  it("never reaches someone who has not bought it: no link, not even the video's id", async () => {
    for (const user of [stranger, null]) {
      const page = await pageFor(exclusive, user)
      expect(page.kind).toBe('locked')
      expect(JSON.stringify(page)).not.toContain(BUNNY_VIDEO)
      expect(JSON.stringify(page)).not.toContain('mediadelivery')
    }
  })

  it('a free YouTube preview next to it is not treated as protected', async () => {
    const page = await pageFor(preview, stranger)
    expect(page.kind === 'ok' && page.protectedVideo).toBe(false)
  })

  it('only accepts a Bunny id (a GUID) when the host is Bunny', async () => {
    await expect(lesson(course, 3, 'bunny', 'dQw4w9WgXcQ', false)).rejects.toThrow()
  })

  it('keeps the length typed in the form when Bunny cannot be asked (no API key in tests)', async () => {
    const saved = await payload.findByID({
      collection: 'lessons',
      id: exclusive.id,
      overrideAccess: true,
    })
    expect(saved.durationSeconds).toBe(300)
  })
})

describe('one device at a time', () => {
  const login = async (email: string) =>
    (await payload.login({ collection: 'users', data: { email, password: PASSWORD } })).token!
  const whoIs = async (token: string) =>
    (await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })).user?.id ??
    null

  it('a student signing in on a second device signs the first one out', async () => {
    const student = await makeUser(payload, 'student')
    const first = await login(student.email)
    expect(await whoIs(first)).toBe(student.id)
    const second = await login(student.email)
    expect(await whoIs(second)).toBe(student.id)
    expect(await whoIs(first)).toBeNull()
  })

  it('does not limit the Admin or instructors', async () => {
    const staff = await makeUser(payload, 'admin')
    const first = await login(staff.email)
    const second = await login(staff.email)
    expect(await whoIs(first)).toBe(staff.id)
    expect(await whoIs(second)).toBe(staff.id)
  })
})
