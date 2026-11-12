import { getTranslations } from 'next-intl/server'

import { isSuperadmin } from '@/access/roles'
import { DoctorBalancesTable, EarningsView } from '@/components/dashboard/EarningsView'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'
import { getOwnerEarnings, listDoctorBalances } from '@/lib/earnings/getOwnerEarnings'

// A doctor sees their own earnings. The owner sees every doctor's balance. Managers are sent away.
export default async function EarningsPage() {
  const user = await requireDashboardUser('superadmin', 'admin')

  if (!isSuperadmin(user)) {
    return (
      <EarningsView
        data={await getOwnerEarnings(user, user.id)}
        canManage={false}
        showDoctor={false}
      />
    )
  }

  const [t, rows] = await Promise.all([
    getTranslations('dashboard.earnings'),
    listDoctorBalances(user),
  ])
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t('doctorsTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('doctorsHelp')}</p>
      </div>
      <DoctorBalancesTable rows={rows} />
    </section>
  )
}
