import type { Access } from 'payload'

import { hasRole, isSuperadmin } from './roles'

/** The owner reads every payout; a doctor reads only the ones recorded for them. Nobody else reads any. */
export const readOwnPayoutOrSuperadmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperadmin(user)) return true
  if (hasRole(user, 'admin')) return { owner: { equals: user.id } }
  return false
}
