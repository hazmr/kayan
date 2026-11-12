import type { Course } from '@/payload-types'

export type CourseStatus = Course['status']

/**
 * The course status diagram as data. One academy, so there is no review step: the Admin and
 * instructors publish directly. COURSE_TRANSITIONS[from] lists where a course may go next.
 *
 *   draft --publish--> published --archive--> archived --unarchive--> published
 */
export const COURSE_TRANSITIONS: Record<CourseStatus, readonly CourseStatus[]> = {
  draft: ['published'],
  published: ['archived'],
  archived: ['published'],
}

export const COURSE_STATUSES = Object.keys(COURSE_TRANSITIONS) as CourseStatus[]

/** The statuses a course may move to from `from`. Used to decide which buttons to show. */
export function nextStatusesFor(from: CourseStatus): CourseStatus[] {
  return [...COURSE_TRANSITIONS[from]]
}
