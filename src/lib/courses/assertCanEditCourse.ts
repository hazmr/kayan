import type { PayloadRequest } from 'payload'

import { isStaff } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'

/**
 * Used when a module or lesson is created or moved: only the Admin and instructors may change
 * course content. Collection access rules cannot check this on create (the new document does
 * not exist yet), so a hook calls this too. The course id is checked to exist.
 */
export async function assertCanEditCourse(courseId: string, req: PayloadRequest): Promise<void> {
  // No user means trusted server code (a script or our own library), not an API request.
  if (!req.user) return
  if (!isStaff(req.user)) throw new AppError('FORBIDDEN')
  const course = await req.payload
    .findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!course) throw new AppError('NOT_FOUND')
}
