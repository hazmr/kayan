import type { Access } from 'payload'

import { hasRole, isStaff } from './roles'

/** Staff read every payout; a doctor reads only the ones recorded for them. Nobody else reads any. */
export const readOwnPayoutOrStaff: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isStaff(user)) return true
  if (hasRole(user, 'admin')) return { owner: { equals: user.id } }
  return false
}
