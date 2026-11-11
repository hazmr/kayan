// Role helpers shared by every access rule. Keeping them here means a rule reads like
// the access table in docs/02-design.md, and a change to a role is made in one place.

export const ROLES = ['superadmin', 'manager', 'admin', 'student'] as const

export type Role = (typeof ROLES)[number]

export const DEFAULT_ROLE: Role = 'student'

/** Anything that might carry a role: a logged-in user, a guest (null), or the admin panel's user object. */
type MaybeUser = object | null | undefined

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function roleOf(user: MaybeUser): Role | null {
  if (!user || !('role' in user)) return null
  return isRole(user.role) ? user.role : null
}

export function hasRole(user: MaybeUser, ...allowed: Role[]): boolean {
  const role = roleOf(user)
  return role !== null && allowed.includes(role)
}

export function isSuperadmin(user: MaybeUser): boolean {
  return hasRole(user, 'superadmin')
}

/** Platform staff: the people who review courses and payments. */
export function isStaff(user: MaybeUser): boolean {
  return hasRole(user, 'superadmin', 'manager')
}

/** Everyone except students may open /admin. */
export function canUseAdminPanel(user: MaybeUser): boolean {
  return hasRole(user, 'superadmin', 'manager', 'admin')
}
