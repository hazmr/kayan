// Creates the first superadmin. Run it once per environment:
//
//   SUPERADMIN_EMAIL=you@example.com SUPERADMIN_PASSWORD='a-long-password' pnpm superadmin:create
//
// The values are passed on the command line so a real password never sits in a file.
// Why a script and not Payload's "create first user" screen: on a fresh server that screen
// is open to whoever finds it first. Our user hook turns that visitor into a plain student.

import config from '@payload-config'
import { getPayload } from 'payload'

import { TRUSTED_USER_WRITE } from '@/collections/Users/hooks'
import { MIN_PASSWORD_LENGTH } from '@/lib/errors/codes'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const email = process.env.SUPERADMIN_EMAIL
const password = process.env.SUPERADMIN_PASSWORD
const name = process.env.SUPERADMIN_NAME ?? 'Owner'

if (!email || !password) {
  fail('Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD before running this script.')
}
if (password.length < MIN_PASSWORD_LENGTH) {
  fail(`SUPERADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`)
}

const payload = await getPayload({ config })

const existing = await payload.find({
  collection: 'users',
  where: { email: { equals: email.toLowerCase() } },
  limit: 1,
  depth: 0,
})

if (existing.totalDocs > 0) {
  fail('A user with this email already exists. Nothing was changed.')
}

await payload.create({
  collection: 'users',
  data: {
    email,
    password,
    name,
    role: 'superadmin',
    // The owner created this account by hand, so there is no email to verify.
    _verified: true,
  },
  context: { [TRUSTED_USER_WRITE]: true },
  disableVerificationEmail: true,
})

console.log('Superadmin created. You can now log in at /admin.')
process.exit(0)
