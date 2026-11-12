import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { pick } from '@/lib/dashboard/localized'
import type { OrderRow } from '@/lib/dashboard/orderQueries'
import { ORDER_STATUSES, type OrderStatus } from '@/lib/orders/transitions'

type Query = { status?: string; q?: string; page?: number }

function href(query: Query) {
  const clean = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== '' && value !== 1),
  )
  return { pathname: '/dashboard/orders', query: clean } as const
}

/** The status tabs. */
export async function StatusTabs({
  statuses,
  selected,
  search,
}: {
  statuses: readonly OrderStatus[]
  selected?: string
  search?: string
}) {
  const [t, tStatus] = await Promise.all([
    getTranslations('dashboard.ordersPage'),
    getTranslations('orderStatus'),
  ])
  const tabs = [
    { value: undefined, label: t('all') },
    ...statuses.map((s) => ({ value: s, label: tStatus(s) })),
  ]

  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.value === selected
        return (
          <Link
            key={tab.value ?? 'all'}
            href={href({ status: tab.value, q: search })}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground'
                : 'rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export async function Pagination({
  page,
  totalPages,
  query,
}: {
  page: number
  totalPages: number
  query: Omit<Query, 'page'>
}) {
  const t = await getTranslations('dashboard.ordersPage')
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href({ ...query, page: page - 1 })}>← {t('previous')}</Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">{t('page', { page, pages: totalPages })}</span>
      {page < totalPages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href({ ...query, page: page + 1 })}>{t('next')} →</Link>
        </Button>
      ) : (
        <span />
      )}
    </div>
  )
}

export async function StaffOrdersTable({ rows }: { rows: OrderRow[] }) {
  const [t, tMethods, locale, format] = await Promise.all([
    getTranslations('dashboard.ordersPage'),
    getTranslations('orders.methodNames'),
    getLocale(),
    getFormatter(),
  ])

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-muted">
          <tr>
            {(
              [
                'colReference',
                'colStudent',
                'colCourse',
                'colAmount',
                'colMethod',
                'colStatus',
                'colDate',
              ] as const
            ).map((key) => (
              <th key={key} className="px-4 py-2 text-start font-medium">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.reference}>
              <td className="px-4 py-3 font-medium" dir="ltr">
                {row.reference}
              </td>
              <td className="px-4 py-3">
                {row.student.name}
                <span className="block text-xs text-muted-foreground" dir="ltr">
                  {row.student.email}
                </span>
              </td>
              <td className="px-4 py-3">{pick(row.courseTitle, locale)}</td>
              <td className="px-4 py-3">
                {format.number(row.amountEgp, {
                  style: 'currency',
                  currency: 'EGP',
                  maximumFractionDigits: 0,
                })}
              </td>
              <td className="px-4 py-3">{row.method ? tMethods(row.method) : '-'}</td>
              <td className="px-4 py-3">
                <span className="flex flex-wrap items-center gap-1">
                  <OrderStatusBadge status={row.status} />
                  {row.refundRequested && <Badge variant="secondary">{t('refundAsked')}</Badge>}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { ORDER_STATUSES }
