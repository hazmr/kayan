import { getTranslations } from 'next-intl/server'

import { Pagination, StaffOrdersTable, StatusTabs } from '@/components/dashboard/OrdersTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listOrdersForStaff } from '@/lib/dashboard/orderQueries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'
import { ORDER_STATUSES } from '@/lib/orders/transitions'

interface PageProps {
  searchParams: Promise<{
    status?: string | string[]
    q?: string | string[]
    page?: string | string[]
  }>
}

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The Admin and instructors see every order of the academy.
export default async function OrdersPage({ searchParams }: PageProps) {
  const [user, params, t, tCommon] = await Promise.all([
    requireDashboardUser(),
    searchParams,
    getTranslations('dashboard.ordersPage'),
    getTranslations('dashboard.common'),
  ])
  const page = Math.max(1, Number.parseInt(first(params.page) ?? '1', 10) || 1)
  const rawStatus = first(params.status)

  const status = ORDER_STATUSES.find((value) => value === rawStatus)
  const search = first(params.q)
  const result = await listOrdersForStaff(user, { status, search, page })

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('help')}</p>
      </div>

      <form method="get" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <Input
          name="q"
          defaultValue={search}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
        />
        <Button type="submit" variant="outline">
          {tCommon('search')}
        </Button>
      </form>

      <StatusTabs statuses={ORDER_STATUSES} selected={status} search={search} />
      <p className="text-sm text-muted-foreground">{t('total', { count: result.totalDocs })}</p>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <StaffOrdersTable rows={result.rows} />
      )}
      <Pagination page={result.page} totalPages={result.totalPages} query={{ status, q: search }} />
    </section>
  )
}
