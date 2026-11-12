import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload'

import { DEFAULT_ROLE, isSuperadmin } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'
import { MIN_PASSWORD_LENGTH } from '@/lib/errors/codes'
import type { User } from '@/payload-types'

/**
 * Trusted server-side scripts (for example create-superadmin) set this on the request context
 * to write a role without a logged-in superadmin. Nothing reachable from the internet sets it.
 */
export const TRUSTED_USER_WRITE = 'trustedUserWrite'

/**
 * Only the `pnpm master:set` command sets this, to pick (or move) the master owner. It is
 * separate from TRUSTED_USER_WRITE on purpose: the role endpoint is "trusted", and still must
 * not be able to touch the master owner.
 */
export const MASTER_OWNER_SCRIPT = 'masterOwnerScript'

function isTrusted(req: PayloadRequest): boolean {
  return req.context[TRUSTED_USER_WRITE] === true
}

/**
 * A role changes only through the role endpoint (src/collections/Users/endpoints.ts), which asks
 * for the owner's password and emails everyone involved. That endpoint marks its request as
 * trusted. Every other way of writing a role is refused here, including a normal save by the
 * owner, so a role can never change by accident.
 *
 * Accounts are created as students, except by the owner, who may create staff and doctors
 * directly. Making someone an owner always goes through the endpoint.
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

/**
 * The master owner is out of reach of everyone else, owners included:
 *   - nobody can mark an account as master through the app (only the server command can);
 *   - nobody but the master can save changes to the master's account (name, email, password, ...);
 *   - the master's role cannot change, not even by the master.
 * This runs for the API and for our own code alike, and the "trusted" flag does not skip it.
 */
export const protectMasterOwnerOnChange: CollectionBeforeChangeHook<User> = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (req.context[MASTER_OWNER_SCRIPT] === true) return data

  if (operation === 'create') {
    if (data.isMasterOwner === true) throw new AppError('MASTER_OWNER_PROTECTED')
    return data
  }

  const wasMaster = originalDoc?.isMasterOwner === true
  if (data.isMasterOwner !== undefined && data.isMasterOwner !== wasMaster) {
    throw new AppError('MASTER_OWNER_PROTECTED')
  }
  if (!wasMaster) return data

  // Our own code and the person's own login/verify flows have no other user in `req`.
  if (req.user && req.user.id !== originalDoc.id) throw new AppError('MASTER_OWNER_PROTECTED')
  if (data.role !== undefined && data.role !== 'superadmin') {
    throw new AppError('MASTER_OWNER_PROTECTED')
  }
  return data
}

/** The master owner's account cannot be deleted. */
export const protectMasterOwnerOnDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const user = await req.payload.findByID({
    collection: 'users',
    id,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (user.isMasterOwner === true) throw new AppError('MASTER_OWNER_PROTECTED')
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

/** Owner-promotion requests point at users, so they go first when a user is deleted. */
export const removeOwnerPromotions: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'owner-promotions',
    where: { or: [{ target: { equals: id } }, { requestedBy: { equals: id } }] },
    overrideAccess: true,
    req,
  })
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
