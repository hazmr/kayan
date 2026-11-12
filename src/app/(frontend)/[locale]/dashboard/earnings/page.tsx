import { getTranslations } from 'next-intl/server'

import { isStaff } from '@/access/roles'
import { DoctorBalancesTable, EarningsView } from '@/components/dashboard/EarningsView'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'
import { getOwnerEarnings, listDoctorBalances } from '@/lib/earnings/getOwnerEarnings'

// A doctor sees their own earnings. Managers and the owner see every doctor's balance.
export default async function EarningsPage() {
  const user = await requireDashboardUser()

  if (!isStaff(user)) {
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
