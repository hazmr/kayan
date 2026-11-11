import type { PayloadRequest } from 'payload'

import { isStaff } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'

import { courseActorsOf } from './courseActors'

/**
 * Used when a module or lesson is created or moved: the target course must be one this user
 * may edit. Collection access rules cannot check this on create, because the new document
 * does not exist yet, so a hook does it.
 */
export async function assertCanEditCourse(courseId: string, req: PayloadRequest): Promise<void> {
  // No user means trusted server code (a script or our own library), not an API request.
  if (!req.user || isStaff(req.user)) return

  const course = await req.payload
    .findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!course || courseActorsOf(req.user, course).length === 0) {
    throw new AppError('FORBIDDEN')
  }
}
