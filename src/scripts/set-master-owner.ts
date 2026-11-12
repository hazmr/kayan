// Picks the master owner: the one account nobody can demote, edit, or delete from the app,
// not even other owners. Run it on the server (it needs the database), never from a web page:
//
//   MASTER_OWNER_EMAIL=you@example.com pnpm master:set
//
// The account must already exist and already be an owner (superadmin). There is at most one
// master (the database enforces it). To MOVE the title to someone else, add MASTER_OWNER_REPLACE=yes.
// That is deliberate: only someone with access to the server can change who the master is.

import config from '@payload-config'
import { getPayload } from 'payload'

import { MASTER_OWNER_SCRIPT } from '@/collections/Users/hooks'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const email = process.env.MASTER_OWNER_EMAIL?.trim().toLowerCase()
if (!email) fail('Set MASTER_OWNER_EMAIL before running this script.')

const payload = await getPayload({ config })
const context = { [MASTER_OWNER_SCRIPT]: true }

const found = await payload.find({
  collection: 'users',
  where: { email: { equals: email } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const user = found.docs[0]
if (!user) fail('No user has this email. Create the owner first (pnpm superadmin:create).')
if (user.role !== 'superadmin') fail('This account is not an owner. Nothing was changed.')
if (user.isMasterOwner) {
  console.log('This account is already the master owner. Nothing to do.')
  process.exit(0)
}

const current = await payload.find({
  collection: 'users',
  where: { isMasterOwner: { equals: true } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const existing = current.docs[0]
if (existing) {
  if (process.env.MASTER_OWNER_REPLACE !== 'yes') {
    fail(
      `${existing.email} is already the master owner. To move the title, run again with MASTER_OWNER_REPLACE=yes.`,
    )
  }
  await payload.update({
    collection: 'users',
    id: existing.id,
    data: { isMasterOwner: false },
    context,
    overrideAccess: true,
  })
}

await payload.update({
  collection: 'users',
  id: user.id,
  data: { isMasterOwner: true },
  context,
  overrideAccess: true,
})

console.log(`${user.email} is now the master owner.`)
process.exit(0)
