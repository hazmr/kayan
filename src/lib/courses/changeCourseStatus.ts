import type { PayloadRequest } from 'payload'

import { withTransaction } from '@/lib/db/withTransaction'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { AppError } from '@/lib/errors/AppError'
import type { Course } from '@/payload-types'

import { courseActorsOf } from './courseActors'
import { COURSE_TRANSITIONS, type CourseStatus } from './transitions'

interface ChangeCourseStatusArgs {
  courseId: string
  to: CourseStatus
  /** Required when sending a course back to draft. */
  note?: string
  req: PayloadRequest
}

/** A course can be reviewed only when a student could actually buy and watch it. */
async function assertComplete(course: Course, req: PayloadRequest): Promise<void> {
  if (!course.category || !course.thumbnail) throw new AppError('COURSE_INCOMPLETE')

  // Every lesson belongs to a module, so one lesson proves there is a module too.
  const lessons = await req.payload.count({
    collection: 'lessons',
    where: { course: { equals: course.id } },
    overrideAccess: true,
    req,
  })
  if (lessons.totalDocs === 0) throw new AppError('COURSE_INCOMPLETE')
}

/**
 * The only place a course status changes. The status field itself is locked for everyone,
 * so submit, publish, send back, archive, and un-archive all come through here.
 */
export async function changeCourseStatus({
  courseId,
  to,
  note,
  req,
}: ChangeCourseStatusArgs): Promise<Course> {
  if (!req.user) throw new AppError('UNAUTHENTICATED')

  const course = await req.payload
    .findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!course) throw new AppError('NOT_FOUND')

  const actors = courseActorsOf(req.user, course)
  if (actors.length === 0) throw new AppError('FORBIDDEN')

  const allowed = COURSE_TRANSITIONS[course.status][to]
  if (!allowed) throw new AppError('COURSE_INVALID_STATE')
  if (!allowed.some((actor) => actors.includes(actor))) throw new AppError('FORBIDDEN')

  const trimmedNote = note?.trim() ?? ''
  const isSendBack = course.status === 'in_review' && to === 'draft'
  if (isSendBack && trimmedNote === '') throw new AppError('REVIEW_NOTE_REQUIRED')
  if (to === 'in_review') await assertComplete(course, req)

  return withTransaction(req, async () => {
    const updated = await req.payload.update({
      collection: 'courses',
      id: course.id,
      data: {
        status: to,
        // The note explains a send-back. It stays visible while the doctor fixes the course
        // and is cleared once the course is published.
        ...(isSendBack ? { reviewNote: trimmedNote } : {}),
        ...(to === 'published' ? { reviewNote: null } : {}),
      },
      depth: 0,
      // Validate against the Arabic content, which is the language every course must have.
      locale: DEFAULT_LOCALE,
      overrideAccess: true,
      req,
    })

    // An archived course takes no new orders, so students who had only started buying are
    // released. Orders with a receipt waiting stay: that money was already sent.
    if (to === 'archived') {
      await req.payload.update({
        collection: 'orders',
        where: { and: [{ course: { equals: course.id } }, { status: { equals: 'pending' } }] },
        data: { status: 'cancelled' },
        overrideAccess: true,
        req,
      })
    }
    return updated
  })
}
