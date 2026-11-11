import { getTranslations } from 'next-intl/server'
import NextLink from 'next/link'
import { Suspense } from 'react'

import { canUseAdminPanel } from '@/access/roles'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

import { LocaleSwitcher } from './LocaleSwitcher'
import { LogoutButton } from './LogoutButton'

export async function SiteHeader() {
  const [t, user] = await Promise.all([getTranslations('nav'), getCurrentUser()])

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          Vetudy
        </Link>

        <nav className="flex items-center gap-2">
          <Suspense>
            <LocaleSwitcher />
          </Suspense>

          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
              {canUseAdminPanel(user) && (
                <Button asChild variant="ghost" size="sm">
                  {/* The admin panel has no locale in its URL, so this is a plain Next link. */}
                  <NextLink href="/admin">{t('adminPanel')}</NextLink>
                </Button>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t('login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t('register')}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
