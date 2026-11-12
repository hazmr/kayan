import { sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import { ADMIN_ID } from '@/access/roles'
import { TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import { MIN_PASSWORD_LENGTH } from '@/lib/errors/codes'
import type { User } from '@/payload-types'

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }

/**
 * Creates THE Admin, with id zero. Used only by server-side scripts and tests, never by a request.
 *
 * Payload always picks a new random id, so the account is created as a student first and then,
 * in one database statement, given id zero and the Admin role. (The database refuses an Admin
 * with any other id, so the two must change together.) Nothing points at a brand-new account
 * yet, which is what makes changing its id safe.
 */
export async function createAdmin(
  payload: Payload,
  args: { email: string; password: string; name: string },
): Promise<User> {
  if (args.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  const existing = await payload.count({
    collection: 'users',
    where: { role: { equals: 'superadmin' } },
    overrideAccess: true,
  })
  if (existing.totalDocs > 0) throw new Error('An Admin already exists, and there can be only one.')

  const created = await payload.create({
    collection: 'users',
    data: {
      email: args.email,
      password: args.password,
      name: args.name,
      role: 'student',
      // The Admin is made by hand on the server, so there is no email to verify.
      _verified: true,
    },
    context: { [TRUSTED_USER_WRITE]: true },
    disableVerificationEmail: true,
    overrideAccess: true,
  })

  const db = (payload.db as unknown as { drizzle: Executor }).drizzle
  await db.execute(
    sql`UPDATE "users" SET "id" = ${ADMIN_ID}, "role" = 'superadmin' WHERE "id" = ${created.id}`,
  )
  return payload.findByID({ collection: 'users', id: ADMIN_ID, depth: 0, overrideAccess: true })
}
