import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { canUseAdminPanel, hasRole, roleOf } from '@/access/roles'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

import { AccountMenu } from './AccountMenu'
import { LocaleSwitcher } from './LocaleSwitcher'
import { SiteNav, type SiteNavItem } from './SiteNav'

/**
 * Three parts: the logo on one side, the links in the middle, and who you are on the other side.
 * The middle depends on the role: everyone gets Courses; a student also gets their own courses;
 * doctors and staff get the dashboard. On a phone the links drop to a second row.
 */
export async function SiteHeader() {
  const [t, user] = await Promise.all([getTranslations('nav'), getCurrentUser()])
  const role = roleOf(user)

  const items: SiteNavItem[] = [{ href: '/courses', label: t('courses') }]
  if (hasRole(user, 'student')) items.push({ href: '/my-courses', label: t('myCourses') })
  if (user && canUseAdminPanel(user)) items.push({ href: '/dashboard', label: t('adminPanel') })

  return (
    <header className="border-b bg-background">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-2 px-3 sm:grid-cols-[1fr_auto_1fr] sm:px-4">
        <Link href="/" className="py-4 text-lg font-bold text-primary sm:text-xl">
          Vetudy
        </Link>

        <div className="order-last col-span-full border-t py-2 sm:order-none sm:col-span-1 sm:border-t-0 sm:py-0">
          <SiteNav items={items} label={t('menu')} />
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-2">
          {user && role ? (
            <Suspense>
              <AccountMenu name={user.name} role={role} />
            </Suspense>
          ) : (
            <>
              <Suspense>
                <LocaleSwitcher />
              </Suspense>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t('login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t('register')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
