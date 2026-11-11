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

function isTrusted(req: PayloadRequest): boolean {
  return req.context[TRUSTED_USER_WRITE] === true || isSuperadmin(req.user)
}

/**
 * Role and email can only be changed by the superadmin.
 *
 * Field-level access already strips `role` from normal API requests. This hook is the second
 * lock: it also covers code paths that skip access control, such as Payload's
 * "create first user" screen, which would otherwise accept any role.
 */
export const guardProtectedFields: CollectionBeforeChangeHook<User> = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (isTrusted(req)) return data

  if (operation === 'create') {
    return { ...data, role: DEFAULT_ROLE }
  }

  if (data.role !== undefined && data.role !== originalDoc?.role) {
    throw new AppError('FORBIDDEN')
  }
  // Changing the email would skip verification, so users cannot change their own.
  if (data.email !== undefined && data.email !== originalDoc?.email) {
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
