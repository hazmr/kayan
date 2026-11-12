import type { Endpoint, PayloadRequest } from 'payload'

import { isSuperadmin, roleOf, ROLES, type Role } from '@/access/roles'
import { passwordMatches } from '@/lib/auth/verifyPassword'
import { AppError } from '@/lib/errors/AppError'
import { MIN_PASSWORD_LENGTH } from '@/lib/errors/codes'
import {
  applyRoleChange,
  confirmOwnerPromotion,
  requestOwnerPromotion,
} from '@/lib/users/ownerPromotion'
import type { User } from '@/payload-types'

function readString(body: unknown, key: string): string | null {
  if (typeof body !== 'object' || body === null || !(key in body)) return null
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' && value !== '' ? value : null
}

async function readBody(req: PayloadRequest): Promise<unknown> {
  return req.json?.().catch(() => null)
}

/**
 * The shared gate for dangerous account actions: only an owner, never on their own account,
 * and only after typing their password again.
 */
async function authorizeOwnerAction(
  req: PayloadRequest,
  body: unknown,
): Promise<{ owner: User; target: User }> {
  const owner = req.user
  if (!owner) throw new AppError('UNAUTHENTICATED')
  if (!isSuperadmin(owner)) throw new AppError('FORBIDDEN')

  const targetId = req.routeParams?.id
  if (typeof targetId !== 'string') throw new AppError('NOT_FOUND')
  if (targetId === owner.id) throw new AppError('SELF_CHANGE_NOT_ALLOWED')

  const password = readString(body, 'password')
  if (!password || !(await passwordMatches(owner.email, password, req))) {
    throw new AppError('WRONG_PASSWORD')
  }

  const target = await req.payload
    .findByID({ collection: 'users', id: targetId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!target) throw new AppError('NOT_FOUND')
  return { owner, target }
}

/**
 * POST /api/users/change-password  { currentPassword, newPassword }
 * Asks for the current password, so someone who finds an unlocked browser
 * cannot quietly take over the account.
 */
export const changePasswordEndpoint: Endpoint = {
  path: '/change-password',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new AppError('UNAUTHENTICATED')

    const body = await readBody(req)
    const currentPassword = readString(body, 'currentPassword')
    const newPassword = readString(body, 'newPassword')
    if (!currentPassword || !newPassword) throw new AppError('VALIDATION_FAILED')
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new AppError('PASSWORD_TOO_SHORT')
    if (!(await passwordMatches(req.user.email, currentPassword, req))) {
      throw new AppError('WRONG_PASSWORD')
    }

    await req.payload.update({
      collection: 'users',
      id: req.user.id,
      data: { password: newPassword },
      overrideAccess: true,
      req,
    })
    return Response.json({ ok: true })
  },
}

/**
 * POST /api/users/:id/role  { role, password }
 * The only way a role changes. The owner confirms with their password, cannot change their own
 * role, and the person plus every owner is emailed. The last-owner rule still applies.
 * Making someone an owner only starts a request; see confirmOwnerEndpoint.
 */
export const changeRoleEndpoint: Endpoint = {
  path: '/:id/role',
  method: 'post',
  handler: async (req) => {
    const body = await readBody(req)
    const role = readString(body, 'role')
    if (!role || !(ROLES as readonly string[]).includes(role)) {
      throw new AppError('VALIDATION_FAILED')
    }
    const { owner, target } = await authorizeOwnerAction(req, body)
    const to = role as Role
    if ((roleOf(target) ?? 'student') === to) return Response.json({ id: target.id, role: to })

    // Making someone an owner needs a second step: a link emailed to the requesting owner.
    if (to === 'superadmin') {
      await requestOwnerPromotion(target, owner, req)
      return Response.json({ id: target.id, pending: true })
    }

    await applyRoleChange(target, to, owner, req)
    return Response.json({ id: target.id, role: to })
  },
}

/**
 * POST /api/users/:id/delete  { password }
 * Deleting an account cannot be undone, so it asks for the owner's password too.
 */
export const deleteUserEndpoint: Endpoint = {
  path: '/:id/delete',
  method: 'post',
  handler: async (req) => {
    const body = await readBody(req)
    const { target } = await authorizeOwnerAction(req, body)
    await req.payload.delete({ collection: 'users', id: target.id, overrideAccess: true, req })
    return Response.json({ id: target.id })
  },
}

/**
 * POST /api/users/confirm-owner  { token }
 * Step 2 of making someone an owner, sent by the Confirm button on the page the email links to.
 */
export const confirmOwnerEndpoint: Endpoint = {
  path: '/confirm-owner',
  method: 'post',
  handler: async (req) => {
    const token = readString(await readBody(req), 'token')
    if (!token) throw new AppError('INVALID_TOKEN')
    const target = await confirmOwnerPromotion(token, req)
    return Response.json({ id: target.id, role: 'superadmin' })
  },
}
