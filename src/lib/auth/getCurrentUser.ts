import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { User } from '@/payload-types'

/**
 * The logged-in user for the current request, or null for a guest.
 * Server Components only. `cache` makes several calls in one request cost one lookup.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return user
})
