import { getTranslations } from 'next-intl/server'

import { QueueOverview, RevenueOverview } from '@/components/dashboard/Overviews'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'
import { getStaffOverview } from '@/lib/dashboard/overview'
import { getAcademyRevenue } from '@/lib/earnings/getAcademyRevenue'

// The same page for the Admin and every instructor: the work waiting, then the academy's money.
export default async function DashboardHome() {
  const user = await requireDashboardUser()
  const [t, queues, revenue] = await Promise.all([
    getTranslations('dashboard.overview'),
    getStaffOverview(user),
    getAcademyRevenue(user),
  ])
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('help')}</p>
      </div>
      <QueueOverview data={queues} />
      <RevenueOverview data={revenue} />
    </section>
  )
}
