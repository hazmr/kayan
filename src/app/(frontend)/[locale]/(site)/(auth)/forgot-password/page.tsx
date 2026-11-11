import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/AuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgot')

  return (
    <AuthCard title={t('title')} description={t('description')}>
      <ForgotPasswordForm />
    </AuthCard>
  )
}
