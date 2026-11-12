import type {
  CollectionAfterLoginHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload'

import { DEFAULT_ROLE, isSuperadmin, roleOf } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'
import { MIN_PASSWORD_LENGTH } from '@/lib/errors/codes'
import type { User } from '@/payload-types'

/**
 * Trusted server-side scripts (for example create-superadmin) set this on the request context
 * to write a role without a logged-in superadmin. Nothing reachable from the internet sets it.
 */
export const TRUSTED_USER_WRITE = 'trustedUserWrite'

function isTrusted(req: PayloadRequest): boolean {
  return req.context[TRUSTED_USER_WRITE] === true
}

/**
 * A role changes only through the role endpoint (src/collections/Users/endpoints.ts), which asks
 * for the owner's password and emails everyone involved. That endpoint marks its request as
 * trusted. Every other way of writing a role is refused here, including a normal save by the
 * owner, so a role can never change by accident.
 *
 * Accounts are created as students, except by the Admin, who may create instructors directly.
 * Nobody is ever made Admin through the app: there is exactly one, made by the server script.
 */
export const guardProtectedFields: CollectionBeforeChangeHook<User> = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (isTrusted(req)) return data

  if (operation === 'create') {
    const ownerIsCreating = isSuperadmin(req.user)
    if (!ownerIsCreating) return { ...data, role: DEFAULT_ROLE }
    if (data.role === 'superadmin') throw new AppError('FORBIDDEN')
    return data
  }

  if (data.role !== undefined && data.role !== originalDoc?.role) {
    throw new AppError('FORBIDDEN')
  }
  // Changing the email would skip verification. Only the owner may correct one.
  if (data.email !== undefined && data.email !== originalDoc?.email && !isSuperadmin(req.user)) {
    throw new AppError('FORBIDDEN')
  }
  return data
}

async function assertAnotherSuperadminExists(
  excludedId: User['id'],
  req: PayloadRequest,
): Promise<void> {
  const { totalDocs } = await req.payload.count({
    collection: 'users',
    where: {
      and: [{ role: { equals: 'superadmin' } }, { id: { not_equals: excludedId } }],
    },
    overrideAccess: true,
    req,
  })
  if (totalDocs === 0) {
    throw new AppError('LAST_SUPERADMIN')
  }
}

/** The last superadmin cannot be demoted: nobody would be left to manage roles. */
export const protectLastSuperadminOnChange: CollectionBeforeChangeHook<User> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const isDemotion =
    operation === 'update' &&
    originalDoc?.role === 'superadmin' &&
    data.role !== undefined &&
    data.role !== 'superadmin'

  if (isDemotion) {
    await assertAnotherSuperadminExists(originalDoc.id, req)
  }
  return data
}

/** The last superadmin cannot be deleted either. */
export const protectLastSuperadminOnDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const user = await req.payload.findByID({
    collection: 'users',
    id,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (user.role === 'superadmin') {
    await assertAnotherSuperadminExists(user.id, req)
  }
}

function readPassword(args: unknown): unknown {
  if (typeof args !== 'object' || args === null || !('data' in args)) return undefined
  const { data } = args
  if (typeof data !== 'object' || data === null || !('password' in data)) return undefined
  return data.password
}

/**
 * Payload's own minimum password length is 3 and cannot be configured.
 * This runs before register, profile update, and password reset, so all three get the same rule.
 */
export const enforcePasswordLength: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation === 'create' || operation === 'update' || operation === 'resetPassword') {
    const password = readPassword(args)
    if (typeof password === 'string' && password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError('PASSWORD_TOO_SHORT')
    }
  }
  return args
}

/**
 * An account that owns courses or has orders or enrollments stays, because those records
 * (and the money history behind them) point at it. The owner would remove the access instead.
 */
export const refuseDeleteWhenInUse: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const [courses, orders, enrollments] = await Promise.all([
    req.payload.count({
      collection: 'courses',
      where: { owner: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'orders',
      where: { user: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'enrollments',
      where: { user: { equals: id } },
      overrideAccess: true,
      req,
    }),
  ])
  if (courses.totalDocs + orders.totalDocs + enrollments.totalDocs > 0) {
    throw new AppError('USER_HAS_RECORDS')
  }
}

/** The session id inside a login token (the middle part of the JWT), or null. */
function sessionIdOf(token: string | undefined): string | null {
  const part = token?.split('.')[1]
  if (!part) return null
  try {
    const claims: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
    const sid =
      typeof claims === 'object' && claims !== null ? (claims as { sid?: unknown }).sid : null
    return typeof sid === 'string' ? sid : null
  } catch {
    return null
  }
}

/**
 * One device at a time for students: logging in signs out every other device. Paid lessons
 * are personal, and this stops one account being shared by a whole group. (Payload rejects a
 * token whose session no longer exists, so the other devices are logged out on their next
 * click.) Staff are not limited.
 */
export const oneDeviceForStudents: CollectionAfterLoginHook<User> = async ({
  user,
  token,
  req,
}) => {
  if (roleOf(user) !== 'student') return
  const keep = sessionIdOf(token)
  if (!keep) return
  const full = await req.payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    req,
  })
  const sessions = full.sessions ?? []
  if (sessions.length <= 1) return
  await req.payload.db.updateOne({
    collection: 'users',
    id: user.id,
    data: { sessions: sessions.filter((session) => session.id === keep) },
    req,
    returning: false,
  })
}
