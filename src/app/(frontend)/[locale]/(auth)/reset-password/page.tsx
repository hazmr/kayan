import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/AuthCard'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

interface PageProps {
  searchParams: Promise<{ token?: string | string[] }>
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const [t, { token }] = await Promise.all([getTranslations('auth.reset'), searchParams])

  if (typeof token !== 'string' || token === '') {
    return (
      <AuthCard title={t('missingTitle')} description={t('missingBody')}>
        <Button asChild variant="outline">
          <Link href="/forgot-password">{t('requestNew')}</Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('title')} description={t('description')}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  )
}
