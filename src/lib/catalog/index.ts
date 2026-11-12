import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { relationId } from '@/collections/shared/relationId'
import type { Locale } from '@/i18n/locales'
import { piastersToEgp } from '@/lib/money'
import { hasFullCourseAccess } from '@/lib/enrollments/canWatchLesson'
import type { Course, User } from '@/payload-types'

import { CATALOG_PAGE_SIZE, sortOrder, type CatalogPrice, type CatalogSort } from './params'
import type { CategoryNode, CourseCardData, CourseDetail, ModuleOutline } from './types'

// Read functions for the public site. They bypass access control on purpose and compensate
// in two ways: every query asks for published courses only, and every result is copied into
// a shaped object from ./types, so only listed fields can reach a page.

const PUBLISHED: Where = { status: { equals: 'published' } }

function toCard(course: Course): CourseCardData {
  const owner = typeof course.owner === 'object' ? course.owner : null
  const category = typeof course.category === 'object' ? course.category : null
  const image = typeof course.thumbnail === 'object' ? course.thumbnail : null
  const imageUrl = image?.sizes?.card?.url ?? image?.url

  return {
    slug: course.slug ?? course.id,
    title: course.title ?? '',
    priceEgp: piastersToEgp(course.price),
    ownerName: owner?.name ?? '',
    categoryTitle: category?.title ?? null,
    thumbnail: imageUrl ? { url: imageUrl, alt: image?.alt ?? course.title ?? '' } : null,
  }
}

/** Main categories with their subcategories, for the catalog filter. */
export async function listCategories(locale: Locale): Promise<CategoryNode[]> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 200,
    locale,
    sort: 'title',
  })

  const nodes = new Map<string, CategoryNode>()
  for (const category of docs) {
    if (!category.parent && category.slug) {
      nodes.set(category.id, { slug: category.slug, title: category.title ?? '', children: [] })
    }
  }
  for (const category of docs) {
    const parent = nodes.get(relationId(category.parent) ?? '')
    if (parent && category.slug) {
      parent.children.push({ slug: category.slug, title: category.title ?? '' })
    }
  }
  return [...nodes.values()]
}

/** Ids of a category and its subcategories, or null when the slug does not exist. */
async function categoryIdsFor(slug: string): Promise<string[] | null> {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
  })
  const category = found.docs[0]
  if (!category) return null

  const children = await payload.find({
    collection: 'categories',
    where: { parent: { equals: category.id } },
    depth: 0,
    limit: 200,
  })
  return [category.id, ...children.docs.map((child) => child.id)]
}

export async function listPublishedCourses(options: {
  locale: Locale
  categorySlug?: string
  limit?: number
}): Promise<CourseCardData[]> {
  const payload = await getPayload({ config })

  let where: Where = PUBLISHED
  if (options.categorySlug) {
    const ids = await categoryIdsFor(options.categorySlug)
    if (!ids) return []
    // Choosing a main category also shows courses filed under its subcategories.
    where = { and: [PUBLISHED, { category: { in: ids } }] }
  }

  const { docs } = await payload.find({
    collection: 'courses',
    where,
    depth: 1,
    limit: options.limit ?? 60,
    locale: options.locale,
    overrideAccess: true,
    sort: '-createdAt',
  })
  return docs.map(toCard)
}

export interface CatalogSearch {
  locale: Locale
  categorySlug?: string
  /** Already cleaned with cleanSearch. Matches the title in either language, and the doctor's name. */
  search?: string
  sort?: CatalogSort
  price?: CatalogPrice
  page?: number
}

export interface CatalogPage {
  courses: CourseCardData[]
  page: number
  totalPages: number
  totalDocs: number
}

/**
 * The catalog with search, sorting, a price filter, and pages. Published courses only: the
 * published filter is always one half of an `and`, so no search word can widen it.
 */
export async function searchPublishedCourses(options: CatalogSearch): Promise<CatalogPage> {
  const payload = await getPayload({ config })
  const filters: Where[] = [PUBLISHED]

  if (options.categorySlug) {
    const ids = await categoryIdsFor(options.categorySlug)
    if (!ids) return { courses: [], page: 1, totalPages: 0, totalDocs: 0 }
    // Choosing a main category also shows courses filed under its subcategories.
    filters.push({ category: { in: ids } })
  }
  if (options.search) {
    filters.push({
      or: [
        { 'title.ar': { contains: options.search } },
        { 'title.en': { contains: options.search } },
        { 'owner.name': { contains: options.search } },
      ],
    })
  }
  if (options.price === 'free') filters.push({ price: { equals: 0 } })
  if (options.price === 'paid') filters.push({ price: { greater_than: 0 } })

  const result = await payload.find({
    collection: 'courses',
    where: { and: filters },
    depth: 1,
    limit: CATALOG_PAGE_SIZE,
    page: options.page ?? 1,
    locale: options.locale,
    overrideAccess: true,
    sort: sortOrder(options.sort ?? 'newest'),
  })
  return {
    courses: result.docs.map(toCard),
    page: result.page ?? 1,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
  }
}

/** How much there is to learn: published courses and their lessons. Shown on the home page. */
export async function getCatalogStats(): Promise<{ courses: number; lessons: number }> {
  const payload = await getPayload({ config })
  const [courses, lessons] = await Promise.all([
    payload.count({ collection: 'courses', where: PUBLISHED, overrideAccess: true }),
    payload.count({
      collection: 'lessons',
      where: { 'course.status': { equals: 'published' } },
      overrideAccess: true,
    }),
  ])
  return { courses: courses.totalDocs, lessons: lessons.totalDocs }
}

/** One published course with its outline. Null when it does not exist or is not public. */
export async function getPublishedCourse(
  slug: string,
  locale: Locale,
): Promise<CourseDetail | null> {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'courses',
    where: { and: [PUBLISHED, { slug: { equals: slug } }] },
    depth: 1,
    limit: 1,
    locale,
    overrideAccess: true,
  })
  const course = found.docs[0]
  if (!course) return null

  const [modules, lessons] = await Promise.all([
    payload.find({
      collection: 'modules',
      where: { course: { equals: course.id } },
      depth: 0,
      limit: 200,
      locale,
      overrideAccess: true,
      sort: 'position',
    }),
    payload.find({
      collection: 'lessons',
      where: { course: { equals: course.id } },
      depth: 0,
      limit: 1000,
      locale,
      overrideAccess: true,
      sort: 'position',
      // Ask the database for outline fields only. The video id is never loaded here.
      select: { title: true, module: true, durationSeconds: true, isFreePreview: true },
    }),
  ])

  const outline: ModuleOutline[] = modules.docs.map((courseModule) => ({
    id: courseModule.id,
    title: courseModule.title ?? '',
    lessons: lessons.docs
      .filter((lesson) => relationId(lesson.module) === courseModule.id)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title ?? '',
        durationSeconds: lesson.durationSeconds,
        isFreePreview: lesson.isFreePreview === true,
      })),
  }))

  return {
    ...toCard(course),
    id: course.id,
    description: course.description ?? '',
    ownerId: relationId(course.owner) ?? '',
    modules: outline,
    lessonCount: lessons.docs.length,
    totalSeconds: lessons.docs.reduce((sum, lesson) => sum + lesson.durationSeconds, 0),
  }
}

/** Does this visitor have the whole course (staff, its doctor, or an enrolled student)? */
export async function hasFullAccessTo(
  user: User | null,
  course: Pick<CourseDetail, 'id' | 'ownerId'>,
): Promise<boolean> {
  const payload = await getPayload({ config })
  return hasFullCourseAccess(user, { id: course.id, owner: course.ownerId }, payload)
}
