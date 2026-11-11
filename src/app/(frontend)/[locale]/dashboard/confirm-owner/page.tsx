import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { ConfirmOwnerButton } from '@/components/dashboard/ConfirmOwnerButton'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'
import { findPendingPromotion, type PendingPromotion } from '@/lib/users/ownerPromotion'

interface PageProps {
  searchParams: Promise<{ token?: string | string[] }>
}

// The link in the "confirm a new owner" email lands here. It only shows the request;
// the change happens when the owner presses Confirm.
export default async function ConfirmOwnerPage({ searchParams }: PageProps) {
  const [user, { token }, t] = await Promise.all([
    requireDashboardUser('superadmin'),
    searchParams,
    getTranslations('dashboard.users'),
  ])

  let pending: PendingPromotion | null = null
  if (typeof token === 'string' && token !== '') {
    const payload = await getPayload({ config })
    pending = await findPendingPromotion(token, user, payload).catch(() => null)
  }

  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
      {pending && typeof token === 'string' ? (
        <>
          <h1 className="text-xl font-bold">{t('confirmTitle', { name: pending.target.name })}</h1>
          <p className="text-sm text-muted-foreground">
            {t('confirmBody', { name: pending.target.name, email: pending.target.email })}
          </p>
          <ConfirmOwnerButton token={token} name={pending.target.name} />
        </>
      ) : (
        <>
          <p>{t('confirmInvalid')}</p>
          <Button asChild variant="outline" className="self-start">
            <Link href="/dashboard/users">{t('backToUsers')}</Link>
          </Button>
        </>
      )}
    </section>
  )
}
