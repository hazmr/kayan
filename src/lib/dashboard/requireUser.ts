import { getLocale } from 'next-intl/server'

import { canUseAdminPanel, hasRole, type Role } from '@/access/roles'
import { redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import type { User } from '@/payload-types'

/**
 * Every dashboard page starts with this. Guests go to login, students go home,
 * and a page can ask for specific roles. This only decides what is shown:
 * the API checks every action again on its own.
 */
export async function requireDashboardUser(...roles: Role[]): Promise<User> {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()])
  if (!user) return redirect({ href: '/login', locale })
  if (!canUseAdminPanel(user)) return redirect({ href: '/', locale })
  if (roles.length > 0 && !hasRole(user, ...roles)) {
    return redirect({ href: '/dashboard', locale })
  }
  return user
}
