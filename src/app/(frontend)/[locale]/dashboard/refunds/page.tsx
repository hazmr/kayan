import { getTranslations } from 'next-intl/server'

import { RefundRequestCard } from '@/components/dashboard/QueueCards'
import { listRefundRequests } from '@/lib/dashboard/paymentQueries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

export default async function RefundsPage() {
  const user = await requireDashboardUser('superadmin', 'admin')
  const [t, items] = await Promise.all([
    getTranslations('dashboard.refunds'),
    listRefundRequests(user),
  ])

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('help')}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        items.map((item) => <RefundRequestCard key={item.id} item={item} />)
      )}
    </section>
  )
}
