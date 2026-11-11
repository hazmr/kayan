import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { CopyButton } from '@/components/orders/CopyButton'
import { CancelOrderButton, MethodSwitcher, RefundSection } from '@/components/orders/OrderActions'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { ReceiptForm } from '@/components/orders/ReceiptForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { getMyOrder } from '@/lib/orders/queries'

interface PageProps {
  params: Promise<{ reference: string }>
}

export default async function OrderPage({ params }: PageProps) {
  const [{ reference }, locale, user, t, tStatus, format] = await Promise.all([
    params,
    getLocale(),
    getCurrentUser(),
    getTranslations('orders'),
    getTranslations('orderStatusHelp'),
    getFormatter(),
  ])
  if (!user) {
    return redirect({
      href: { pathname: '/login', query: { next: `/orders/${reference}` } },
      locale,
    })
  }
  const order = await getMyOrder(decodeURIComponent(reference), user, locale)
  // Someone else's order looks exactly like one that does not exist.
  if (!order) notFound()

  const money = (value: number) =>
    value === 0
      ? t('free')
      : format.number(value, { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })
  const stillPaying = order.status === 'pending' || order.status === 'rejected'
  const lastRejection = [...order.receipts]
    .reverse()
    .find((receipt) => receipt.decision === 'rejected')

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Link href="/orders" className="text-sm text-primary underline-offset-4 hover:underline">
          ← {t('title')}
        </Link>
        <h1 className="text-2xl leading-snug font-bold">{order.course.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <span className="text-sm text-muted-foreground" dir="ltr">
            {order.reference}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{tStatus(order.status)}</p>
      </header>

      {order.status === 'rejected' && lastRejection && lastRejection.reviewNote !== '' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">{t('reviewerNote')}</p>
          <p className="whitespace-pre-line">{lastRejection.reviewNote}</p>
        </div>
      )}

      {stillPaying && order.method && order.payTo && (
        <div className="flex flex-col gap-4 rounded-xl border-2 border-primary/30 bg-card p-4 md:p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">{t('amount')}</dt>
              <dd className="text-2xl font-bold text-primary">{money(order.amountEgp)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('method')}</dt>
              <dd className="text-lg font-semibold">{t(`methodNames.${order.method}`)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 rounded-lg bg-muted p-3">
            <span className="text-sm text-muted-foreground">{t('sendTo')}</span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-bold" dir="ltr">
                {order.payTo}
              </span>
              <CopyButton value={order.payTo} />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg bg-muted p-3">
            <span className="text-sm text-muted-foreground">{t('writeReference')}</span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-bold" dir="ltr">
                {order.reference}
              </span>
              <CopyButton value={order.reference} />
            </div>
          </div>

          <MethodSwitcher orderId={order.id} current={order.method} methods={order.methods} />
        </div>
      )}

      {stillPaying && <ReceiptForm orderId={order.id} amount={order.amount} />}

      {order.receipts.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6">
          <h2 className="text-lg font-bold">{t('yourReceipts')}</h2>
          <ul className="flex flex-col gap-3">
            {order.receipts.map((receipt) => (
              <li key={receipt.id} className="flex flex-wrap items-center gap-3 text-sm">
                {/* A plain image, not next/image: receipts are private and must not be cached or proxied. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipt.url} alt="" className="size-16 rounded-md border object-cover" />
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <Badge
                      variant={
                        receipt.decision === 'rejected'
                          ? 'destructive'
                          : receipt.decision === 'approved'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {receipt.decision === 'rejected'
                        ? t('receiptRejected')
                        : receipt.decision === 'approved'
                          ? t('receiptApproved')
                          : t('receiptWaiting')}
                    </Badge>
                    <span className="text-muted-foreground" dir="ltr">
                      {receipt.senderNumber}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(receipt.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.status === 'paid' && (
        <>
          <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-4 md:p-6">
            <p className="font-medium text-primary">{t('owned')}</p>
            <Button asChild variant="outline">
              <Link href={`/courses/${order.course.slug}`}>{t('viewCourse')}</Link>
            </Button>
          </div>
          {order.amount > 0 ? (
            <RefundSection orderId={order.id} status={order.refundStatus} refund={order.refund} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('refundNone')}</p>
          )}
        </>
      )}

      {stillPaying && <CancelOrderButton orderId={order.id} />}
    </section>
  )
}
