import type { Access, PayloadRequest, Where } from 'payload'

import { isStaff } from './roles'

/**
 * Courses, modules, and lessons share the same visibility rules. The only difference is where
 * the course fields live: on the document itself ('') or one relationship away ('course.').
 */
type CoursePath = '' | 'course.'

/**
 * Who can read:
 *   the Admin and instructors   everything (it is one academy)
 *   everyone else               published courses only
 */
export function readCourseContent(path: CoursePath): Access {
  return ({ req: { user } }) => {
    if (isStaff(user)) return true
    const published: Where = { [`${path}status`]: { equals: 'published' } }
    return published
  }
}

/** Who can edit or delete course content: the Admin and instructors. */
export function editCourseContent(_path: CoursePath): Access {
  return ({ req: { user } }) => isStaff(user)
}

export const createCourseContent: Access = ({ req: { user } }) => isStaff(user)

export const staffOnly: Access = ({ req: { user } }) => isStaff(user)

export const anyone: Access = () => true

export function isStaffRequest(req: PayloadRequest): boolean {
  return isStaff(req.user)
}
