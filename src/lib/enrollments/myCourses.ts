import config from '@payload-config'
import { getPayload } from 'payload'

import { relationId } from '@/collections/shared/relationId'
import type { Locale } from '@/i18n/locales'
import type { CatalogImage } from '@/lib/catalog/types'
import type { Course, User } from '@/payload-types'

export interface MyCourse {
  id: string
  slug: string
  title: string
  doctorName: string
  thumbnail: CatalogImage | null
  lessonCount: number
  /** An archived course is no longer sold, but its students keep access. */
  archived: boolean
  /** Where "Continue learning" goes. Absent when the course has no lessons yet. */
  firstLessonId: string | null
}

/**
 * The courses a student owns: every ACTIVE enrollment, newest first. A refunded student's
 * enrollment is revoked, so that course disappears here at once.
 */
export async function listMyCourses(user: User, locale: Locale): Promise<MyCourse[]> {
  const payload = await getPayload({ config })

  const { docs: enrollments } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
    depth: 2,
    limit: 200,
    sort: '-updatedAt',
    locale,
    overrideAccess: true,
  })
  const courses = enrollments
    .map((enrollment) => (typeof enrollment.course === 'object' ? enrollment.course : null))
    .filter((course): course is Course => course !== null)
  if (courses.length === 0) return []

  const courseIds = courses.map((course) => course.id)
  const [modules, lessons] = await Promise.all([
    payload.find({
      collection: 'modules',
      where: { course: { in: courseIds } },
      depth: 0,
      limit: 1000,
      sort: 'position',
      overrideAccess: true,
      select: { course: true, position: true },
    }),
    payload.find({
      collection: 'lessons',
      where: { course: { in: courseIds } },
      depth: 0,
      limit: 5000,
      sort: 'position',
      overrideAccess: true,
      // Ids and order only: the video id is never loaded here.
      select: { course: true, module: true, position: true },
    }),
  ])

  const modulePosition = new Map(modules.docs.map((item) => [item.id, item.position]))

  return courses.map((course): MyCourse => {
    const own = lessons.docs.filter((lesson) => relationId(lesson.course) === course.id)
    // The first lesson is the first one of the first module.
    const first = [...own].sort(
      (a, b) =>
        (modulePosition.get(relationId(a.module) ?? '') ?? 0) -
          (modulePosition.get(relationId(b.module) ?? '') ?? 0) || a.position - b.position,
    )[0]
    const doctor = typeof course.owner === 'object' ? course.owner : null
    const image = typeof course.thumbnail === 'object' ? course.thumbnail : null
    const imageUrl = image?.sizes?.card?.url ?? image?.url

    return {
      id: course.id,
      slug: course.slug ?? course.id,
      title: course.title ?? '',
      doctorName: doctor?.name ?? '',
      thumbnail: imageUrl ? { url: imageUrl, alt: image?.alt ?? course.title ?? '' } : null,
      lessonCount: own.length,
      archived: course.status === 'archived',
      firstLessonId: first?.id ?? null,
    }
  })
}
