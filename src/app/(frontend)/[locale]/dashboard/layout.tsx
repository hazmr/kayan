import { getTranslations } from 'next-intl/server'
import { ExternalLink } from 'lucide-react'
import { Suspense, type ReactNode } from 'react'

import { isStaff, isSuperadmin, roleOf } from '@/access/roles'
import { DashboardNav, type NavItem } from '@/components/dashboard/DashboardNav'
import { AccountMenu } from '@/components/site/AccountMenu'
import { Link } from '@/i18n/navigation'
import { countAwaitingReview, countRefundRequests } from '@/lib/dashboard/paymentQueries'
import { countCoursesInReview } from '@/lib/dashboard/queries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

/**
 * The dashboard's own frame, separate from the public site: a dark sidebar with the navigation
 * and the account, and a calm grey work area. Same font and brand colour, different room.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireDashboardUser()
  const t = await getTranslations('dashboard.nav')
  const staff = isStaff(user)
  const role = roleOf(user)

  // Each role sees only the sections it can use.
  const coursesItem: NavItem = { href: '/dashboard/courses', label: t('courses'), icon: 'courses' }
  const overviewItem: NavItem = { href: '/dashboard', label: t('overview'), icon: 'overview' }
  // Money pages: a doctor sees their own earnings, the owner sees every doctor's.
  // Managers have no money pages.
  const earningsItem: NavItem = {
    href: '/dashboard/earnings',
    label: isSuperadmin(user) ? t('doctorsEarnings') : t('earnings'),
    icon: 'earnings',
  }
  const ordersItem: NavItem = {
    href: '/dashboard/orders',
    label: staff ? t('orders') : t('sales'),
    icon: 'orders',
  }

  const items: NavItem[] = [overviewItem]
  if (staff) {
    // Staff work from the queues, so those come first: receipts, refunds, courses to review.
    const [inReview, receipts, refunds] = await Promise.all([
      countCoursesInReview(user),
      countAwaitingReview(user),
      countRefundRequests(user),
    ])
    if (inReview > 0) coursesItem.badge = String(inReview)
    items.push({
      href: '/dashboard/payments',
      label: t('payments'),
      icon: 'payments',
      badge: receipts > 0 ? String(receipts) : undefined,
    })
    items.push({
      href: '/dashboard/refunds',
      label: t('refunds'),
      icon: 'refunds',
      badge: refunds > 0 ? String(refunds) : undefined,
    })
    items.push(coursesItem, ordersItem)
    if (isSuperadmin(user)) items.push(earningsItem)
    items.push({ href: '/dashboard/categories', label: t('categories'), icon: 'categories' })
    items.push({ href: '/dashboard/users', label: t('users'), icon: 'users' })
  } else {
    items.push(coursesItem, ordersItem, earningsItem)
  }
  if (isSuperadmin(user)) {
    items.push({ href: '/dashboard/settings', label: t('settings'), icon: 'settings' })
  }

  return (
    <div className="min-h-dvh bg-muted/60 md:grid md:grid-cols-[248px_1fr]">
      {/* The outer aside paints the full height; the inner part stays in view while scrolling. */}
      <aside className="bg-sidebar text-sidebar-foreground">
        <div className="flex flex-col gap-3 p-4 md:sticky md:top-0 md:h-dvh md:gap-4">
          <Link href="/dashboard" className="flex items-baseline gap-2 px-3 pt-1">
            <span className="text-xl font-bold text-sidebar-accent-foreground">Vetudy</span>
            <span className="rounded-md bg-sidebar-primary px-1.5 py-0.5 text-xs font-semibold text-sidebar-primary-foreground">
              {role === 'superadmin' ? t('owner') : role === 'manager' ? t('manager') : t('studio')}
            </span>
          </Link>

          <div className="md:flex-1">
            <DashboardNav items={items} label={t('menu')} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar: the way back to the site, and everything about "me" (language included). */}
        <div className="flex h-14 items-center justify-end gap-2 border-b bg-background px-4 md:px-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t('viewSite')}
          </Link>
          <Suspense>
            <AccountMenu name={user.name} role={roleOf(user) ?? 'admin'} />
          </Suspense>
        </div>

        <main className="min-w-0 p-4 md:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
