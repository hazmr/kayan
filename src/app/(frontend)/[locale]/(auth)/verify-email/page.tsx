import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { AuthCard } from '@/components/auth/AuthCard'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

interface PageProps {
  searchParams: Promise<{ token?: string | string[] }>
}

/** True when the token was valid and the account is now verified. */
async function verifyToken(token: string): Promise<boolean> {
  const payload = await getPayload({ config })
  try {
    return await payload.verifyEmail({ collection: 'users', token })
  } catch {
    // Payload throws for an unknown or already used token. Both mean "not verified by this link".
    return false
  }
}

// The link in the verification email lands here.
export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const [t, tNav, { token }] = await Promise.all([
    getTranslations('auth.verify'),
    getTranslations('nav'),
    searchParams,
  ])
  const verified = typeof token === 'string' && token !== '' ? await verifyToken(token) : false

  return (
    <AuthCard
      title={verified ? t('successTitle') : t('failedTitle')}
      description={verified ? t('successBody') : t('failedBody')}
    >
      <Button asChild>
        <Link href="/login">{tNav('login')}</Link>
      </Button>
    </AuthCard>
  )
}
