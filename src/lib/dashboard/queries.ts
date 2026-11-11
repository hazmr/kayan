import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { isStaff, isSuperadmin, roleOf } from '@/access/roles'
import { relationId } from '@/collections/shared/relationId'
import { DEFAULT_OWNER_SHARE_PERCENT } from '@/globals/PlatformSettings'
import { courseActorsOf } from '@/lib/courses/courseActors'
import { nextStatusesFor, type CourseStatus } from '@/lib/courses/transitions'
import { piastersToEgp } from '@/lib/money'
import type { User } from '@/payload-types'

import type {
  CategoryOption,
  CourseEdit,
  CourseRow,
  Localized,
  ModuleEdit,
  PersonOption,
  UserRow,
} from './types'

// Read functions for the dashboard. Unlike the public catalog, these run WITH access control
// (`overrideAccess: false` plus the logged-in user), so Payload decides what each role may see.
// Everything is loaded with `locale: 'all'`, which returns localized fields as { ar, en }.

function localized(value: unknown): Localized {
  if (typeof value === 'string') return { ar: value, en: '' }
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >
  return {
    ar: typeof record.ar === 'string' ? record.ar : '',
    en: typeof record.en === 'string' ? record.en : '',
  }
}

/** Courses for the dashboard list. A doctor sees their own; staff see everyone's. */
export async function listCourses(user: User, status?: CourseStatus): Promise<CourseRow[]> {
  const payload = await getPayload({ config })
  const filters: Where[] = []
  // A doctor may read other doctors' published courses, but this list is "my courses".
  if (!isStaff(user)) filters.push({ owner: { equals: user.id } })
  if (status) filters.push({ status: { equals: status } })

  const { docs } = await payload.find({
    collection: 'courses',
    where: filters.length > 0 ? { and: filters } : {},
    depth: 1,
    limit: 200,
    locale: 'all',
    overrideAccess: false,
    sort: '-updatedAt',
    user,
  })

  return docs.map((course) => ({
    id: course.id,
    title: localized(course.title),
    status: course.status,
    ownerName: typeof course.owner === 'object' ? course.owner.name : '',
    priceEgp: piastersToEgp(course.price),
    updatedAt: course.updatedAt,
  }))
}

export async function countCoursesInReview(user: User): Promise<number> {
  const payload = await getPayload({ config })
  const { totalDocs } = await payload.count({
    collection: 'courses',
    where: { status: { equals: 'in_review' } },
    overrideAccess: false,
    user,
  })
  return totalDocs
}

/** Everything the course editor needs. Null when the course is missing or not this user's to edit. */
export async function getCourseForEdit(user: User, id: string): Promise<CourseEdit | null> {
  const payload = await getPayload({ config })
  const course = await payload
    .findByID({ collection: 'courses', id, depth: 1, locale: 'all', overrideAccess: false, user })
    .catch(() => null)
  if (!course) return null

  const actors = courseActorsOf(user, course)
  if (actors.length === 0) return null

  const [modules, lessons] = await Promise.all([
    payload.find({
      collection: 'modules',
      where: { course: { equals: course.id } },
      depth: 0,
      limit: 200,
      locale: 'all',
      overrideAccess: false,
      sort: 'position',
      user,
    }),
    payload.find({
      collection: 'lessons',
      where: { course: { equals: course.id } },
      depth: 0,
      limit: 1000,
      locale: 'all',
      overrideAccess: false,
      sort: 'position',
      user,
    }),
  ])

  const moduleList: ModuleEdit[] = modules.docs.map((courseModule) => ({
    id: courseModule.id,
    title: localized(courseModule.title),
    position: courseModule.position,
    lessons: lessons.docs
      .filter((lesson) => relationId(lesson.module) === courseModule.id)
      .map((lesson) => ({
        id: lesson.id,
        title: localized(lesson.title),
        position: lesson.position,
        videoId: lesson.videoId ?? '',
        durationSeconds: lesson.durationSeconds,
        isFreePreview: lesson.isFreePreview === true,
      })),
  }))

  const owner = typeof course.owner === 'object' ? course.owner : null
  const thumbnail = typeof course.thumbnail === 'object' ? course.thumbnail : null
  const thumbnailUrl = thumbnail?.sizes?.card?.url ?? thumbnail?.url

  return {
    id: course.id,
    slug: course.slug ?? '',
    title: localized(course.title),
    description: localized(course.description),
    status: course.status,
    reviewNote: course.reviewNote ?? '',
    categoryId: relationId(course.category) ?? '',
    thumbnail: thumbnail && thumbnailUrl ? { id: thumbnail.id, url: thumbnailUrl } : null,
    priceEgp: piastersToEgp(course.price),
    owner: { id: owner?.id ?? relationId(course.owner) ?? '', name: owner?.name ?? '' },
    ownerSharePercent: course.ownerSharePercent ?? null,
    modules: moduleList,
    can: {
      editPrice: isStaff(user) || course.status === 'draft',
      editOwnerAndShare: isSuperadmin(user),
      moveTo: nextStatusesFor(course.status, actors),
    },
  }
}

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 500,
    locale: 'all',
    sort: 'createdAt',
  })
  return docs.map((category) => ({
    id: category.id,
    slug: category.slug ?? '',
    title: localized(category.title),
    parentId: relationId(category.parent),
  }))
}

/** Doctor accounts, for the "which doctor owns this course" picker. Staff only. */
export async function listDoctors(user: User): Promise<PersonOption[]> {
  if (!isStaff(user)) return []
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    depth: 0,
    limit: 500,
    overrideAccess: false,
    sort: 'name',
    user,
  })
  return docs.map((doctor) => ({ id: doctor.id, name: doctor.name, email: doctor.email }))
}

export async function listUsers(user: User, search?: string): Promise<UserRow[]> {
  if (!isStaff(user)) return []
  const payload = await getPayload({ config })
  const term = search?.trim()
  const { docs } = await payload.find({
    collection: 'users',
    where: term ? { or: [{ email: { contains: term } }, { name: { contains: term } }] } : {},
    depth: 0,
    limit: 200,
    overrideAccess: false,
    sort: '-createdAt',
    user,
  })
  return docs.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: roleOf(row) ?? 'student',
    verified: row._verified === true,
  }))
}

export async function getDefaultOwnerSharePercent(user: User): Promise<number> {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({
    slug: 'platform-settings',
    overrideAccess: false,
    user,
  })
  return settings.defaultOwnerSharePercent ?? DEFAULT_OWNER_SHARE_PERCENT
}
