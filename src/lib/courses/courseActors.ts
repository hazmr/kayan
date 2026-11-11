import { roleOf } from '@/access/roles'
import { relationId } from '@/collections/shared/relationId'
import type { Course } from '@/payload-types'

import type { CourseActor } from './transitions'

/** Which hats this user wears for this course. Empty means they have no say over it. */
export function courseActorsOf(
  user: { id: string; role?: unknown } | null | undefined,
  course: Pick<Course, 'owner'>,
): CourseActor[] {
  const role = roleOf(user)
  if (!user || !role) return []
  if (role === 'superadmin') return ['superadmin']
  if (role === 'manager') return ['manager']
  if (role === 'admin' && relationId(course.owner) === user.id) return ['owner']
  return []
}
