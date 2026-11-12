import { getFormatter, getTranslations } from 'next-intl/server'

import { isSuperadmin } from '@/access/roles'
import {
  DeletePaymentButton,
  RecordPaymentButton,
} from '@/components/dashboard/AdminPaymentActions'
import { getMoneyFormatter, Stat } from '@/components/dashboard/Stat'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'
import { getAcademyRevenue } from '@/lib/earnings/getAcademyRevenue'

/**
 * The Admin's share, the same page for the Admin and every instructor: what the Admin has earned,
 * what the academy has paid them, what is still owed, and every payment. Anyone who runs the
 * academy can record a payment; only the Admin can remove one (with their password).
 */
export default async function AdminSharePage() {
  const user = await requireDashboardUser()
  const [t, format, money, data] = await Promise.all([
    getTranslations('dashboard.earnings'),
    getFormatter(),
    getMoneyFormatter(),
    getAcademyRevenue(user),
  ])
  const negative = data.owedToAdmin < 0
  const canDelete = isSuperadmin(user)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('help', { percent: data.adminSharePercent })}
          </p>
        </div>
        <RecordPaymentButton balance={data.owedToAdmin} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('earned')} value={money(data.admin)} />
        <Stat label={t('paid')} value={money(data.paidToAdmin)} />
        <Stat label={t('owed')} value={money(data.owedToAdmin)} tone={negative ? 'bad' : 'good'} />
      </div>
      {negative && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {t('owedNegative')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('payments')}</h2>
        {data.payments.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            {t('noPayments')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">{t('colDate')}</th>
                  <th className="px-4 py-2 text-start font-medium">{t('colAmount')}</th>
                  <th className="px-4 py-2 text-start font-medium">{t('colNote')}</th>
                  <th className="px-4 py-2 text-start font-medium">{t('colRecordedBy')}</th>
                  {canDelete && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">
                      {format.dateTime(new Date(payment.paidAt), { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(payment.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{payment.note}</td>
                    <td className="px-4 py-3 text-muted-foreground">{payment.recordedBy}</td>
                    {canDelete && (
                      <td className="px-4 py-3 text-end">
                        <DeletePaymentButton
                          paymentId={payment.id}
                          amount={payment.amount}
                          paidAt={payment.paidAt}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
