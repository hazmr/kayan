import config from '@payload-config'
import { getPayload } from 'payload'

import { relationId } from '@/collections/shared/relationId'
import type { Locale } from '@/i18n/locales'
import { canWatch, hasFullCourseAccess } from '@/lib/enrollments/canWatchLesson'
import { piastersToEgp } from '@/lib/money'
import { getVideoProvider } from '@/lib/video'
import type { User } from '@/payload-types'

export interface WatchLessonRef {
  id: string
  title: string
  durationSeconds: number
  isFreePreview: boolean
  /** Whether this person may open it. Locked lessons are still listed, so people see what they get. */
  watchable: boolean
}

export interface WatchModule {
  id: string
  title: string
  lessons: WatchLessonRef[]
}

interface WatchBase {
  course: { id: string; slug: string; title: string; priceEgp: number }
  modules: WatchModule[]
  current: WatchLessonRef
  previous: WatchLessonRef | null
  next: WatchLessonRef | null
  position: { number: number; total: number }
}

export type WatchPage =
  | { kind: 'notFound' }
  | ({ kind: 'ok'; embedUrl: string } & WatchBase)
  // No video information at all: only the outline, which is public anyway.
  | ({ kind: 'locked'; loggedIn: boolean } & WatchBase)

/**
 * Everything the lesson page shows, and the one place a video address is produced.
 *
 * The order matters: the outline is loaded WITHOUT video fields, access is decided, and only
 * for an allowed viewer is the video id read from the database and turned into an embed URL.
 * A denied viewer therefore never has a video id in memory, let alone in the page they get.
 */
export async function getWatchPage(
  courseSlug: string,
  lessonId: string,
  user: User | null,
  locale: Locale,
): Promise<WatchPage> {
  const payload = await getPayload({ config })

  const found = await payload.find({
    collection: 'courses',
    where: { slug: { equals: courseSlug } },
    depth: 0,
    limit: 1,
    locale,
    overrideAccess: true,
  })
  const course = found.docs[0]
  if (!course) return { kind: 'notFound' }

  const hasFullAccess = await hasFullCourseAccess(user, course, payload)
  // A course that is not public (draft, in review, archived) does not exist for people who
  // have no claim on it. An archived course still opens for the students who bought it.
  if (!hasFullAccess && course.status !== 'published') return { kind: 'notFound' }

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
      // Outline fields only. The video id is not loaded here.
      select: { title: true, module: true, durationSeconds: true, isFreePreview: true },
    }),
  ])

  const outline: WatchModule[] = modules.docs.map((courseModule) => ({
    id: courseModule.id,
    title: courseModule.title ?? '',
    lessons: lessons.docs
      .filter((lesson) => relationId(lesson.module) === courseModule.id)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title ?? '',
        durationSeconds: lesson.durationSeconds,
        isFreePreview: lesson.isFreePreview === true,
        watchable: canWatch({
          hasFullAccess,
          courseStatus: course.status,
          isFreePreview: lesson.isFreePreview === true,
        }),
      })),
  }))

  const flat = outline.flatMap((courseModule) => courseModule.lessons)
  const index = flat.findIndex((lesson) => lesson.id === lessonId)
  const current = flat[index]
  if (!current) return { kind: 'notFound' }

  const base: WatchBase = {
    course: {
      id: course.id,
      slug: course.slug ?? course.id,
      title: course.title ?? '',
      priceEgp: piastersToEgp(course.price),
    },
    modules: outline,
    current,
    previous: flat[index - 1] ?? null,
    next: flat[index + 1] ?? null,
    position: { number: index + 1, total: flat.length },
  }

  if (!current.watchable) return { kind: 'locked', loggedIn: user !== null, ...base }

  // Allowed. Only now is the video id read.
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: current.id,
    depth: 0,
    overrideAccess: true,
    select: { videoProvider: true, videoId: true },
  })
  const playback = await getVideoProvider(lesson.videoProvider).getPlayback(lesson.videoId, {
    userId: user?.id,
  })
  return { kind: 'ok', embedUrl: playback.embedUrl, ...base }
}
