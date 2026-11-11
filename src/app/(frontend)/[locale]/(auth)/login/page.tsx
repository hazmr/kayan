import { getLocale, getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/AuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export default async function LoginPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('auth.login'),
    getLocale(),
    getCurrentUser(),
  ])
  // Someone already logged in has nothing to do here.
  if (user) redirect({ href: '/', locale })

  return (
    <AuthCard title={t('title')} description={t('description')}>
      <LoginForm />
    </AuthCard>
  )
}
