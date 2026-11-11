import { getTranslations } from 'next-intl/server'

import { PaymentSettingsForm } from '@/components/dashboard/PaymentSettingsForm'
import { SettingsForm } from '@/components/dashboard/SettingsForm'
import { getPaymentSettingsForStaff } from '@/lib/dashboard/paymentQueries'
import { getDefaultOwnerSharePercent } from '@/lib/dashboard/queries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

export default async function DashboardSettingsPage() {
  const user = await requireDashboardUser('superadmin')
  const [t, share, payment] = await Promise.all([
    getTranslations('dashboard.settings'),
    getDefaultOwnerSharePercent(user),
    getPaymentSettingsForStaff(user),
  ])

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6">
        <h2 className="text-lg font-bold">{t('shareTitle')}</h2>
        <SettingsForm defaultOwnerSharePercent={share} />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6">
        <h2 className="text-lg font-bold">{t('paymentTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('paymentHelp')}</p>
        <PaymentSettingsForm {...payment} />
      </div>
    </section>
  )
}
