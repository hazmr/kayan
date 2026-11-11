import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { Button } from '@/components/ui/button'
import { Link, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { listMyOrders } from '@/lib/orders/queries'

export default async function OrdersPage() {
  const [locale, user, t, format] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    getTranslations('orders'),
    getFormatter(),
  ])
  if (!user) return redirect({ href: { pathname: '/login', query: { next: '/orders' } }, locale })
  const orders = await listMyOrders(user, locale)

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{t('empty')}</p>
          <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
          <Button asChild>
            <Link href="/courses">{t('browse')}</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t('colCourse')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('colAmount')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('colStatus')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('colDate')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.reference}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.reference}`}
                      className="font-medium hover:text-primary"
                    >
                      {order.courseTitle}
                    </Link>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {order.reference}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {order.amountEgp === 0
                      ? t('free')
                      : format.number(order.amountEgp, {
                          style: 'currency',
                          currency: 'EGP',
                          maximumFractionDigits: 0,
                        })}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format.dateTime(new Date(order.createdAt), { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/orders/${order.reference}`}>{t('open')}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
