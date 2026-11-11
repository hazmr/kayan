import type { Payload } from 'payload'

import { isStaff } from '@/access/roles'
import { relationId } from '@/collections/shared/relationId'
import type { Course, User } from '@/payload-types'

import { hasActiveEnrollment } from './enrollments'

/**
 * Does this person have the whole course? Staff and the course's own doctor always do.
 * Everyone else needs an active enrollment, which is the ONLY thing that grants access:
 * orders are never read to decide it. (A future subscription adds one more line here.)
 */
export async function hasFullCourseAccess(
  user: User | null,
  course: Pick<Course, 'id' | 'owner'>,
  payload: Payload,
): Promise<boolean> {
  if (!user) return false
  if (isStaff(user) || relationId(course.owner) === user.id) return true
  return hasActiveEnrollment(user.id, course.id, payload)
}

/**
 * The rule for one lesson, once we know whether the person has the whole course:
 *   whole course  -> every lesson (an archived course keeps its students)
 *   no access     -> only a free preview, and only while the course is published
 */
export function canWatch(args: {
  hasFullAccess: boolean
  courseStatus: Course['status']
  isFreePreview: boolean
}): boolean {
  if (args.hasFullAccess) return true
  return args.isFreePreview && args.courseStatus === 'published'
}

/** The same rule in one call, for places that check a single lesson. */
export async function canWatchLesson(
  lesson: { isFreePreview?: boolean | null },
  course: Pick<Course, 'id' | 'owner' | 'status'>,
  user: User | null,
  payload: Payload,
): Promise<boolean> {
  return canWatch({
    hasFullAccess: await hasFullCourseAccess(user, course, payload),
    courseStatus: course.status,
    isFreePreview: lesson.isFreePreview === true,
  })
}
