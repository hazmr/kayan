import type { PayloadRequest } from 'payload'

import { isStaff } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'
import type { User } from '@/payload-types'

/** The logged-in user, or a 401. Endpoints and library functions start with this. */
export function requireUser(req: PayloadRequest): User {
  if (!req.user) throw new AppError('UNAUTHENTICATED')
  return req.user
}

/** The logged-in user, who must also be a manager or the owner. */
export function requireStaff(req: PayloadRequest): User {
  const user = requireUser(req)
  if (!isStaff(user)) throw new AppError('FORBIDDEN')
  return user
}
