import { createHash, randomBytes } from 'crypto'
import type { Payload, PayloadRequest } from 'payload'

import { isSuperadmin, roleOf, type Role } from '@/access/roles'
import { relationId } from '@/collections/shared/relationId'
import { TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import { sendRoleChangedEmails } from '@/lib/email/accountEmails'
import { sendOwnerConfirmEmail } from '@/lib/email/ownerConfirmEmail'
import { AppError } from '@/lib/errors/AppError'
import type { User } from '@/payload-types'

const LINK_LIFETIME_MS = 30 * 60 * 1000 // 30 minutes

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function ownerEmails(req: PayloadRequest): Promise<string[]> {
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { role: { equals: 'superadmin' } },
    depth: 0,
    limit: 50,
    overrideAccess: true,
    req,
  })
  return docs.map((user) => user.email)
}

/** Saves a role and tells the person and every owner. Shared by both paths below. */
export async function applyRoleChange(
  target: User,
  to: Role,
  changedBy: User,
  req: PayloadRequest,
): Promise<void> {
  const from = roleOf(target) ?? 'student'
  await req.payload.update({
    collection: 'users',
    id: target.id,
    data: { role: to },
    context: { [TRUSTED_USER_WRITE]: true },
    depth: 0,
    overrideAccess: true,
    req,
  })
  await sendRoleChangedEmails(
    {
      person: { name: target.name, email: target.email },
      from,
      to,
      changedBy: { name: changedBy.name, email: changedBy.email },
    },
    await ownerEmails(req),
    req,
  )
}

/**
 * Step 1 of making someone an owner. The caller has already checked the owner's password.
 * Nothing changes yet: a confirmation link goes to the requesting owner's own email.
 */
export async function requestOwnerPromotion(
  target: User,
  requestedBy: User,
  req: PayloadRequest,
): Promise<void> {
  // One open request per person: a new one replaces any older one.
  await req.payload.delete({
    collection: 'owner-promotions',
    where: { and: [{ target: { equals: target.id } }, { confirmedAt: { exists: false } }] },
    overrideAccess: true,
    req,
  })

  const token = randomBytes(32).toString('hex')
  await req.payload.create({
    collection: 'owner-promotions',
    data: {
      target: target.id,
      requestedBy: requestedBy.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LINK_LIFETIME_MS).toISOString(),
    },
    overrideAccess: true,
    req,
  })
  await sendOwnerConfirmEmail({ to: requestedBy, target, token }, req)
}

export interface PendingPromotion {
  id: string
  target: User
}

/**
 * Looks up a confirmation link. It is valid only for the owner who asked, before it expires,
 * and only once. Every failure looks the same, so the link reveals nothing to anyone else.
 */
export async function findPendingPromotion(
  token: string,
  user: User | null,
  payload: Payload,
  req?: PayloadRequest,
): Promise<PendingPromotion> {
  if (!user) throw new AppError('UNAUTHENTICATED')

  const { docs } = await payload.find({
    collection: 'owner-promotions',
    where: { tokenHash: { equals: hashToken(token) } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
    req,
  })
  const request = docs[0]
  const target = request && typeof request.target === 'object' ? request.target : null
  const valid =
    request !== undefined &&
    target !== null &&
    !request.confirmedAt &&
    Date.parse(request.expiresAt) > Date.now() &&
    relationId(request.requestedBy) === user.id &&
    isSuperadmin(user)
  if (!valid) throw new AppError('INVALID_TOKEN')
  return { id: request.id, target }
}

/** Step 2: the owner clicked the link while logged in and pressed Confirm. */
export async function confirmOwnerPromotion(token: string, req: PayloadRequest): Promise<User> {
  const { id, target } = await findPendingPromotion(token, req.user, req.payload, req)
  const owner = req.user
  if (!owner) throw new AppError('UNAUTHENTICATED')

  // Marked used before the role changes, so the same link can never run twice.
  await req.payload.update({
    collection: 'owner-promotions',
    id,
    data: { confirmedAt: new Date().toISOString() },
    overrideAccess: true,
    req,
  })
  await applyRoleChange(target, 'superadmin', owner, req)
  return target
}
