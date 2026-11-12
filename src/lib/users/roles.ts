import type { PayloadRequest } from 'payload'

import { roleOf, type Role } from '@/access/roles'
import { TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import { sendRoleChangedEmails } from '@/lib/email/accountEmails'
import type { User } from '@/payload-types'

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

/** Saves a role and tells the person and the Admin. The caller has already checked who is asking. */
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
