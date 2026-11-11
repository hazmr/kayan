import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export default async function HomePage() {
  const [t, user] = await Promise.all([getTranslations('home'), getCurrentUser()])

  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center">
      {user && (
        <p className="text-sm font-medium text-primary">{t('welcome', { name: user.name })}</p>
      )}
      <h1 className="text-3xl leading-snug font-bold sm:text-4xl">{t('title')}</h1>
      <p className="text-lg text-muted-foreground">{t('subtitle')}</p>

      {!user && (
        <div className="flex flex-col items-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">{t('getStarted')}</Link>
          </Button>
          <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
            {t('haveAccount')}
          </Link>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{t('comingSoon')}</p>
    </section>
  )
}
