import { getTranslations } from 'next-intl/server'

import { isSuperadmin, isStaff } from '@/access/roles'
import { DoctorHome, QueueOverview, RevenueOverview } from '@/components/dashboard/Overviews'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'
import { getDoctorOverview, getStaffOverview } from '@/lib/dashboard/overview'
import { getPlatformRevenue } from '@/lib/earnings/getPlatformRevenue'

// Each role opens on its own page:
//   owner    the work queues, then the whole money picture
//   manager  the work queues only (managers never see revenue)
//   doctor   their own earnings, students, courses, and latest sales
export default async function DashboardHome() {
  const user = await requireDashboardUser()
  const t = await getTranslations('dashboard.overview')

  if (isStaff(user)) {
    const [queues, revenue] = await Promise.all([
      getStaffOverview(user),
      isSuperadmin(user) ? getPlatformRevenue(user) : null,
    ])
    return (
      <section className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {revenue ? t('ownerHelp') : t('managerHelp')}
          </p>
        </div>
        <QueueOverview data={queues} />
        {revenue && <RevenueOverview data={revenue} />}
      </section>
    )
  }

  const data = await getDoctorOverview(user)
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t('doctorTitle', { name: user.name })}</h1>
        <p className="text-sm text-muted-foreground">{t('doctorHelp')}</p>
      </div>
      <DoctorHome data={data} />
    </section>
  )
}
