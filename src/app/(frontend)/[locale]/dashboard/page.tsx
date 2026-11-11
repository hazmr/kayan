import { getLocale } from 'next-intl/server'

import { isStaff } from '@/access/roles'
import { redirect } from '@/i18n/navigation'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

// The dashboard opens on the thing each role does most:
// staff on the courses waiting for review, doctors on their own courses.
export default async function DashboardHome() {
  const [user, locale] = await Promise.all([requireDashboardUser(), getLocale()])
  return redirect({
    href: isStaff(user)
      ? { pathname: '/dashboard/courses', query: { status: 'in_review' } }
      : '/dashboard/courses',
    locale,
  })
}
