import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { canUseAdminPanel, isStaff, isSuperadmin } from '@/access/roles'

/** Who may open /admin at all. Students are refused. */
export const canAccessAdminPanel = ({ req }: { req: PayloadRequest }): boolean =>
  canUseAdminPanel(req.user)

/**
 * Registration is open to visitors who are not logged in, and the role hook forces `student`.
 * A logged-in user cannot create other accounts unless they are the superadmin.
 * Why: a logged-in user may set `_verified`, which would let them mint pre-verified accounts.
 */
export const canCreateUser: Access = ({ req: { user } }) => !user || isSuperadmin(user)

/** Staff read everyone. Everybody else reads only their own record. */
export const canReadUser: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isStaff(user)) return true
  return { id: { equals: user.id } }
}

/** The superadmin updates anyone. Everybody else updates only their own record. */
export const canUpdateUser: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperadmin(user)) return true
  return { id: { equals: user.id } }
}

export const superadminOnly: Access = ({ req: { user } }) => isSuperadmin(user)

export const superadminOnlyField: FieldAccess = ({ req: { user } }) => isSuperadmin(user)
