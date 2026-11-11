import type { Course } from '@/payload-types'

export type CourseStatus = Course['status']

/** Who is asking, relative to one course. A person can be more than one. */
export type CourseActor = 'owner' | 'manager' | 'superadmin'

/**
 * The course status diagram from docs/02-design.md as data:
 * COURSE_TRANSITIONS[from][to] lists who may make that move. A missing entry means "never".
 */
export const COURSE_TRANSITIONS: Record<
  CourseStatus,
  Partial<Record<CourseStatus, readonly CourseActor[]>>
> = {
  draft: { in_review: ['owner', 'manager', 'superadmin'] },
  in_review: { published: ['manager', 'superadmin'], draft: ['manager', 'superadmin'] },
  published: { archived: ['manager', 'superadmin'] },
  archived: { published: ['manager', 'superadmin'] },
}

export const COURSE_STATUSES = Object.keys(COURSE_TRANSITIONS) as CourseStatus[]

/** The statuses this set of actors may move a course to from `from`. Used to decide which buttons to show. */
export function nextStatusesFor(
  from: CourseStatus,
  actors: readonly CourseActor[],
): CourseStatus[] {
  return COURSE_STATUSES.filter((to) =>
    COURSE_TRANSITIONS[from][to]?.some((allowed) => actors.includes(allowed)),
  )
}
