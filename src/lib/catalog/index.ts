import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { relationId } from '@/collections/shared/relationId'
import type { Locale } from '@/i18n/locales'
import { piastersToEgp } from '@/lib/money'
import type { Course } from '@/payload-types'

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
    modules: outline,
    lessonCount: lessons.docs.length,
    totalSeconds: lessons.docs.reduce((sum, lesson) => sum + lesson.durationSeconds, 0),
  }
}
