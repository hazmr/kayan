import { getLocale, getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/AuthCard'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export default async function RegisterPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('auth.register'),
    getLocale(),
    getCurrentUser(),
  ])
  if (user) redirect({ href: '/', locale })

  return (
    <AuthCard title={t('title')} description={t('description')}>
      <RegisterForm />
    </AuthCard>
  )
}
