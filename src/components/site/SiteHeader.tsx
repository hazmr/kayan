import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { canUseAdminPanel, roleOf } from '@/access/roles'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

import { AccountMenu } from './AccountMenu'
import { LocaleSwitcher } from './LocaleSwitcher'

/**
 * Two sides: where to go on the site (logo, Courses) and who you are (account menu, or
 * log in / sign up). Language lives in the account menu once you are logged in.
 */
export async function SiteHeader() {
  const [t, user] = await Promise.all([getTranslations('nav'), getCurrentUser()])
  const role = roleOf(user)

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="text-lg font-bold text-primary sm:text-xl">
            Vetudy
          </Link>
          <nav>
            <Link
              href="/courses"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {t('courses')}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {user && role ? (
            <>
              {canUseAdminPanel(user) && (
                <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                  <Link href="/dashboard">{t('adminPanel')}</Link>
                </Button>
              )}
              <Suspense>
                <AccountMenu name={user.name} role={role} showDashboard={canUseAdminPanel(user)} />
              </Suspense>
            </>
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
