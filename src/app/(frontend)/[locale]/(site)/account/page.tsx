import { getLocale, getTranslations } from 'next-intl/server'

import { PasswordForm } from '@/components/account/PasswordForm'
import { ProfileForm } from '@/components/account/ProfileForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export default async function AccountPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations('account'),
    getLocale(),
    getCurrentUser(),
  ])
  if (!user) return redirect({ href: '/login', locale })

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('profileTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            userId={user.id}
            email={user.email}
            name={user.name}
            phone={user.phone ?? ''}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('passwordTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </section>
  )
}
