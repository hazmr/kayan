// Creates THE Admin (role key superadmin), with id zero. There is exactly one, so this runs once
// per environment and refuses if an Admin already exists:
//
//   SUPERADMIN_EMAIL=you@example.com SUPERADMIN_PASSWORD='a-long-password' SUPERADMIN_NAME='Your name' pnpm superadmin:create
//
// The values are passed on the command line so a real password never sits in a file.

import config from '@payload-config'
import { getPayload } from 'payload'

import { createAdmin } from '@/lib/users/createAdmin'

const email = process.env.SUPERADMIN_EMAIL
const password = process.env.SUPERADMIN_PASSWORD
const name = process.env.SUPERADMIN_NAME ?? 'Admin'

if (!email || !password) {
  console.error('Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD before running this script.')
  process.exit(1)
}

const payload = await getPayload({ config })
try {
  const admin = await createAdmin(payload, { email, password, name })
  console.log(`Admin created (id ${admin.id}). You can now log in and open /dashboard.`)
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
