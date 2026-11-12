import { getTranslations } from 'next-intl/server'

import { isSuperadmin } from '@/access/roles'
import { PaymentSettingsForm } from '@/components/dashboard/PaymentSettingsForm'
import { SettingsForm } from '@/components/dashboard/SettingsForm'
import { getPaymentSettingsForStaff } from '@/lib/dashboard/paymentQueries'
import { getAdminSharePercent } from '@/lib/dashboard/queries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

// The Admin and instructors both come here: everyone can change where students send their money
// (it is the academy's account, and every change is emailed to all of them). Only the Admin
// changes their own share of each sale; instructors see it.
export default async function DashboardSettingsPage() {
  const user = await requireDashboardUser()
  const [t, share, payment] = await Promise.all([
    getTranslations('dashboard.settings'),
    getAdminSharePercent(user),
    getPaymentSettingsForStaff(user),
  ])

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6">
        <h2 className="text-lg font-bold">{t('paymentTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('paymentHelp')}</p>
        <PaymentSettingsForm {...payment} />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6">
        <h2 className="text-lg font-bold">{t('shareTitle')}</h2>
        {isSuperadmin(user) ? (
          <SettingsForm adminSharePercent={share} />
        ) : (
          <p className="text-sm">{t('shareReadOnly', { percent: share })}</p>
        )}
      </div>
    </section>
  )
}
