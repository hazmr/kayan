import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { pick } from '@/lib/dashboard/localized'
import type { DoctorBalanceRow, OwnerEarnings } from '@/lib/earnings/getOwnerEarnings'

import { DeletePayoutButton, RecordPayoutButton } from './PayoutActions'
import { getMoneyFormatter, Stat } from './Stat'

/**
 * One doctor's earnings: the totals, sales by course, and every payout. A doctor sees their own;
 * staff open anyone's. Only the owner can record or delete payouts (`canManage`).
 */
export async function EarningsView({
  data,
  canManage,
  showDoctor,
}: {
  data: OwnerEarnings
  canManage: boolean
  /** Staff are looking at someone else, so the doctor's name is shown. */
  showDoctor: boolean
}) {
  const [t, locale, format, money] = await Promise.all([
    getTranslations('dashboard.earnings'),
    getLocale(),
    getFormatter(),
    getMoneyFormatter(),
  ])
  const negative = data.balance < 0

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {showDoctor && (
            <Link
              href="/dashboard/earnings"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              ← {t('back')}
            </Link>
          )}
          <h1 className="text-2xl font-bold">{showDoctor ? data.doctor.name : t('yourTitle')}</h1>
          {showDoctor ? (
            <p className="text-sm text-muted-foreground" dir="ltr">
              {data.doctor.email}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('help')}</p>
          )}
        </div>
        {canManage && (
          <RecordPayoutButton
            doctorId={data.doctor.id}
            doctorName={data.doctor.name}
            balance={data.balance}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('totalEarned')} value={money(data.totalEarned)} />
        <Stat label={t('paidOut')} value={money(data.totalPaidOut)} />
        <Stat
          label={t('balance')}
          value={money(data.balance)}
          tone={negative ? 'bad' : 'good'}
          hint={negative ? undefined : showDoctor ? t('balanceOwed') : t('balanceHelp')}
        />
      </div>
      {negative && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {t('balanceNegative')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('perCourse')}</h2>
        {data.perCourse.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            {t('noSales')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">{t('colCourse')}</th>
                  <th className="px-4 py-2 text-start font-medium">{t('colPaidOrders')}</th>
                  <th className="px-4 py-2 text-start font-medium">{t('colRefunded')}</th>
                  <th className="px-4 py-2 text-start font-medium">{t('colEarned')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.perCourse.map((course) => (
                  <tr key={course.courseId}>
                    <td className="px-4 py-3">{pick(course.title, locale)}</td>
                    <td className="px-4 py-3">{course.paidOrders}</td>
                    <td className="px-4 py-3 text-muted-foreground">{course.refundedOrders}</td>
                    <td className="px-4 py-3 font-medium text-primary">{money(course.earned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold">{t('payouts')}</h2>
          <p className="text-sm text-muted-foreground">{t('payoutsHelp')}</p>
        </div>
        {data.payouts.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            {t('noPayouts')}
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
                  {canManage && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="px-4 py-3">
                      {format.dateTime(new Date(payout.paidAt), { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(payout.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{payout.note}</td>
                    <td className="px-4 py-3 text-muted-foreground">{payout.recordedBy}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-end">
                        <DeletePayoutButton
                          payoutId={payout.id}
                          doctorName={data.doctor.name}
                          amount={payout.amount}
                          paidAt={payout.paidAt}
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

/** The staff overview: every doctor and what they are owed, biggest balance first. */
export async function DoctorBalancesTable({ rows }: { rows: DoctorBalanceRow[] }) {
  const [t, money] = await Promise.all([getTranslations('dashboard.earnings'), getMoneyFormatter()])
  const totals = rows.reduce(
    (sum, row) => ({
      earned: sum.earned + row.earned,
      paidOut: sum.paidOut + row.paidOut,
      balance: sum.balance + row.balance,
    }),
    { earned: 0, paidOut: 0, balance: 0 },
  )

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
        {t('noDoctors')}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-start font-medium">{t('colDoctor')}</th>
            <th className="px-4 py-2 text-start font-medium">{t('colEarned')}</th>
            <th className="px-4 py-2 text-start font-medium">{t('paidOut')}</th>
            <th className="px-4 py-2 text-start font-medium">{t('colBalance')}</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/earnings/${row.id}`}
                  className="font-medium hover:text-primary"
                >
                  {row.name}
                </Link>
                <span className="block text-xs text-muted-foreground" dir="ltr">
                  {row.email}
                </span>
              </td>
              <td className="px-4 py-3">{money(row.earned)}</td>
              <td className="px-4 py-3">{money(row.paidOut)}</td>
              <td
                className={
                  'px-4 py-3 font-bold ' + (row.balance < 0 ? 'text-destructive' : 'text-primary')
                }
              >
                {money(row.balance)}
              </td>
              <td className="px-4 py-3 text-end">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/earnings/${row.id}`}>{t('viewDetails')}</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted font-semibold">
          <tr>
            <td className="px-4 py-2">{t('total')}</td>
            <td className="px-4 py-2">{money(totals.earned)}</td>
            <td className="px-4 py-2">{money(totals.paidOut)}</td>
            <td className="px-4 py-2">{money(totals.balance)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
