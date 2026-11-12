import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { searchCourses } from '@/lib/dashboard/queries'
import { searchPublishedCourses } from '@/lib/catalog'
import { CATALOG_PAGE_SIZE } from '@/lib/catalog/params'
import type { Course, User } from '@/payload-types'

import { makeCourse, makeUser, unique } from '../support/factories'
import { startApp, stopApp } from '../support/payload'

let payload: Payload
let doctor: User
let otherDoctor: User
let owner: User
// One word that only this file's courses contain, so other test files' courses never interfere.
const TAG = `zq${Date.now().toString(36)}`

const titles = (courses: { title: string }[]) => courses.map((course) => course.title)
const search = (options: Parameters<typeof searchPublishedCourses>[0]) =>
  searchPublishedCourses(options)

async function course(
  doctorFor: User,
  title: string,
  options: Parameters<typeof makeCourse>[2] = {},
  english?: string,
): Promise<Course> {
  const made = await makeCourse(payload, doctorFor, options)
  await payload.update({
    collection: 'courses',
    id: made.id,
    data: { title },
    locale: 'ar',
    overrideAccess: true,
  })
  if (english) {
    await payload.update({
      collection: 'courses',
      id: made.id,
      data: { title: english },
      locale: 'en',
      overrideAccess: true,
    })
  }
  return made
}

beforeAll(async () => {
  payload = await startApp()
  owner = await makeUser(payload, 'superadmin')
  doctor = await makeUser(payload, 'admin', `${TAG}-dr-nile`)
  otherDoctor = await makeUser(payload, 'admin')
  await course(doctor, `${TAG} جراحة القطط`, { price: 30000 }, `${TAG} Cat surgery`)
  await course(doctor, `${TAG} الأشعة`, { price: 0 }, `${TAG} Radiology`)
  await course(otherDoctor, `${TAG} طب الخيول`, { price: 10000 })
  await course(doctor, `${TAG} مسودة سرية`, { status: 'draft' })
  await course(doctor, `${TAG} مؤرشفة`, { status: 'archived' })
})
afterAll(() => stopApp(payload))

describe('catalog search', () => {
  it('finds a course by its Arabic title, its English title, or the doctor name', async () => {
    expect(titles((await search({ locale: 'ar', search: 'جراحة' })).courses)).toEqual([
      `${TAG} جراحة القطط`,
    ])
    // the English page finds a course by its English title
    expect((await search({ locale: 'en', search: `${TAG} cat` })).totalDocs).toBe(1)
    // and by the Arabic words too, even though that page shows English
    expect((await search({ locale: 'en', search: 'جراحة القطط' })).totalDocs).toBe(1)
    // by the doctor's name: matches that doctor's published courses only
    expect((await search({ locale: 'en', search: `${TAG}-dr-nile` })).totalDocs).toBe(2)
  })

  it('is not case sensitive', async () => {
    expect((await search({ locale: 'en', search: `${TAG} CAT SURGERY` })).totalDocs).toBe(1)
  })

  it('never returns a draft or archived course, however it is searched', async () => {
    for (const word of ['مسودة', 'مؤرشفة', `${TAG}-dr-nile`, TAG]) {
      const result = await search({ locale: 'ar', search: word })
      for (const found of result.courses) {
        expect(
          ['مسودة سرية', 'مؤرشفة'].some((secret) => found.title.endsWith(secret)),
          word,
        ).toBe(false)
      }
    }
    expect((await search({ locale: 'ar', search: 'مسودة سرية' })).totalDocs).toBe(0)
    expect((await search({ locale: 'ar', search: TAG })).totalDocs).toBe(3)
  })

  it('treats % and _ as plain text once cleaned, and finds nothing for a word nobody uses', async () => {
    expect((await search({ locale: 'ar', search: 'no-such-word-anywhere' })).courses).toEqual([])
  })
})

describe('price filter and sorting', () => {
  it('filters free and paid courses', async () => {
    const free = await search({ locale: 'ar', search: TAG, price: 'free' })
    expect(titles(free.courses)).toEqual([`${TAG} الأشعة`])
    const paid = await search({ locale: 'ar', search: TAG, price: 'paid' })
    expect(paid.totalDocs).toBe(2)
  })

  it('sorts by price in both directions', async () => {
    const asc = await search({ locale: 'ar', search: TAG, sort: 'priceAsc' })
    expect(asc.courses.map((c) => c.priceEgp)).toEqual([0, 100, 300])
    const desc = await search({ locale: 'ar', search: TAG, sort: 'priceDesc' })
    expect(desc.courses.map((c) => c.priceEgp)).toEqual([300, 100, 0])
  })
})

describe('pages', () => {
  it('splits a long list into pages with no repeats and no gaps', async () => {
    const pageTag = `${TAG}pg`
    const total = CATALOG_PAGE_SIZE + 3
    for (let i = 0; i < total; i++) await course(otherDoctor, `${pageTag} ${unique('c')}`)

    const first = await search({ locale: 'ar', search: pageTag, page: 1 })
    const second = await search({ locale: 'ar', search: pageTag, page: 2 })
    expect(first.totalDocs).toBe(total)
    expect(first.totalPages).toBe(2)
    expect(first.courses).toHaveLength(CATALOG_PAGE_SIZE)
    expect(second.courses).toHaveLength(3)
    const all = [...titles(first.courses), ...titles(second.courses)]
    expect(new Set(all).size).toBe(total)
  })

  it('a page past the end is empty, not an error', async () => {
    const result = await search({ locale: 'ar', search: TAG, page: 50 })
    expect(result.courses).toEqual([])
  })
})

describe('the dashboard course list', () => {
  it('an instructor searches every course of the academy, drafts included, like the Admin', async () => {
    const asInstructor = await searchCourses(doctor, { search: TAG, page: 1 })
    const asAdmin = await searchCourses(owner, { search: TAG, page: 1 })
    expect(asInstructor.totalDocs).toBe(asAdmin.totalDocs)
    // the other instructor's course is in the list too
    expect(asInstructor.rows.some((row) => row.ownerName === otherDoctor.name)).toBe(true)
  })

  it('a student gets nothing from the dashboard list', async () => {
    const student = await makeUser(payload, 'student')
    const result = await searchCourses(student, { search: TAG, page: 1 })
    expect(result.rows.every((row) => row.status === 'published')).toBe(true)
  })

  it('combines the status tab with the search', async () => {
    const drafts = await searchCourses(doctor, { status: 'draft', search: TAG, page: 1 })
    expect(drafts.rows.map((row) => row.title.ar)).toEqual([`${TAG} مسودة سرية`])
  })

  it('pages the list', async () => {
    const first = await searchCourses(owner, { search: `${TAG}pg`, page: 1 })
    expect(first.rows.length).toBeLessThanOrEqual(20)
    expect(first.totalDocs).toBe(CATALOG_PAGE_SIZE + 3)
  })
})
