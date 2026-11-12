// Role helpers shared by every access rule. Keeping them here means a rule reads like
// the access table in docs/02-design.md, and a change to a role is made in one place.

// The keys are stored in the database; the labels people see are different:
//   superadmin -> "Admin" (the one person who runs the system)
//   admin      -> "Instructor" (the people who teach and run the academy)
//   student    -> "Student"
export const ROLES = ['superadmin', 'admin', 'student'] as const

export type Role = (typeof ROLES)[number]

export const DEFAULT_ROLE: Role = 'student'

/**
 * The Admin's id. There is exactly one Admin and it is always "id zero" (the all-zero UUID): the
 * database refuses any Admin with another id (migration admin_is_id_zero).
 */
export const ADMIN_ID = '00000000-0000-0000-0000-000000000000'

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

/** The people who run the academy: the Admin and every Instructor. */
export function isStaff(user: MaybeUser): boolean {
  return hasRole(user, 'superadmin', 'admin')
}

/** Everyone except students may open the dashboard. */
export function canUseAdminPanel(user: MaybeUser): boolean {
  return isStaff(user)
}
