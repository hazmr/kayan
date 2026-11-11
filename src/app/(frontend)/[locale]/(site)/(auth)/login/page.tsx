import { getLocale, getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/AuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { safeNext } from '@/lib/auth/safeNext'

interface PageProps {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const [t, locale, user, { next }] = await Promise.all([
    getTranslations('auth.login'),
    getLocale(),
    getCurrentUser(),
    searchParams,
  ])
  const destination = safeNext(next)
  // Someone already logged in has nothing to do here.
  if (user) redirect({ href: destination ?? '/', locale })

  return (
    <AuthCard title={t('title')} description={t('description')}>
      <LoginForm next={destination} />
    </AuthCard>
  )
}
