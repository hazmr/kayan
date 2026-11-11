import type { Access, PayloadRequest, Where } from 'payload'

import { hasRole, isStaff } from './roles'

/**
 * Courses, modules, and lessons share the same visibility rules. The only difference is where
 * the course fields live: on the document itself ('') or one relationship away ('course.').
 */
type CoursePath = '' | 'course.'

/**
 * Who can read:
 *   staff          everything
 *   a doctor       published courses, plus their own in any status
 *   everyone else  published courses only
 */
export function readCourseContent(path: CoursePath): Access {
  return ({ req: { user } }) => {
    if (isStaff(user)) return true
    const published: Where = { [`${path}status`]: { equals: 'published' } }
    if (user && hasRole(user, 'admin')) {
      return { or: [published, { [`${path}owner`]: { equals: user.id } }] }
    }
    return published
  }
}

/** Who can edit or delete: staff everything, a doctor only what belongs to their own course. */
export function editCourseContent(path: CoursePath): Access {
  return ({ req: { user } }) => {
    if (isStaff(user)) return true
    if (user && hasRole(user, 'admin')) return { [`${path}owner`]: { equals: user.id } }
    return false
  }
}

/** Doctors and staff may create course content. Ownership of the target course is checked in a hook. */
export const createCourseContent: Access = ({ req: { user } }) =>
  hasRole(user, 'superadmin', 'manager', 'admin')

export const staffOnly: Access = ({ req: { user } }) => isStaff(user)

export const anyone: Access = () => true

export function isStaffRequest(req: PayloadRequest): boolean {
  return isStaff(req.user)
}
