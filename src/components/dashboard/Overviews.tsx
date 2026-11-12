import { CircleCheck, CreditCard, LayoutList, Undo2 } from 'lucide-react'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import type { DoctorOverview, StaffOverview, WorkItem } from '@/lib/dashboard/overview'
import { pick } from '@/lib/dashboard/localized'
import type { PlatformRevenue } from '@/lib/earnings/getPlatformRevenue'

import { SalesTable } from './OrdersTable'
import { getMoneyFormatter, Stat } from './Stat'

// The first page of the dashboard, one version per role. The three differ in what they know:
//   owner    the whole money picture (this file's RevenueOverview)
//   manager  the work queues, and no money at all (QueueOverview)
//   doctor   only their own numbers (DoctorHome)

// ---------------------------------------------------------------------------------------------
// Work queues: for the owner and managers
// ---------------------------------------------------------------------------------------------

function QueueCard({
  href,
  icon: Icon,
  label,
  count,
}: {
  href: string
  icon: typeof CreditCard
  label: string
  count: number
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
    >
      <span
        className={
          'flex size-11 items-center justify-center rounded-full ' +
          (count > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')
        }
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col">
        <span className="text-2xl leading-none font-bold">{count}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </span>
    </Link>
  )
}

/** A short list of what is waiting, the oldest first, each row opening where it is dealt with. */
async function WorkPanel({
  title,
  count,
  viewAllHref,
  items,
  itemHref,
}: {
  title: string
  count: number
  viewAllHref: string
  items: WorkItem[]
  itemHref: (item: WorkItem) => string
}) {
  const [t, format, locale] = await Promise.all([
    getTranslations('dashboard.overview'),
    getFormatter(),
    getLocale(),
  ])
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-bold">
          {title} <span className="text-muted-foreground">· {count}</span>
        </h2>
        <Link
          href={viewAllHref}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t('viewAll')}
        </Link>
      </div>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={itemHref(item)}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.who}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {pick(item.title, locale as Locale)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end text-end">
                {item.amountEgp !== undefined && (
                  <span className="font-medium text-primary">
                    {format.number(item.amountEgp, {
                      style: 'currency',
                      currency: 'EGP',
                      maximumFractionDigits: 0,
                    })}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {format.relativeTime(new Date(item.since))}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {count > items.length && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          {t('moreWaiting', { count: count - items.length })}
        </p>
      )}
    </section>
  )
}

/**
 * The manager's whole home page (and the top of the owner's): what is waiting for a decision,
 * oldest first, with the first few items listed so the work can start from here. No money split.
 */
export async function QueueOverview({ data }: { data: StaffOverview }) {
  const t = await getTranslations('dashboard.overview')
  const nothingWaiting =
    data.awaitingReceipts === 0 && data.refundRequests === 0 && data.coursesInReview === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <QueueCard
          href="/dashboard/payments"
          icon={CreditCard}
          label={t('queueReceipts')}
          count={data.awaitingReceipts}
        />
        <QueueCard
          href="/dashboard/refunds"
          icon={Undo2}
          label={t('queueRefunds')}
          count={data.refundRequests}
        />
        <QueueCard
          href="/dashboard/courses?status=in_review"
          icon={LayoutList}
          label={t('queueCourses')}
          count={data.coursesInReview}
        />
      </div>

      {nothingWaiting ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-10 text-center">
          <CircleCheck className="size-10 text-primary" aria-hidden />
          <p className="text-lg font-bold">{t('caughtUpTitle')}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t('caughtUpBody')}</p>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {data.receipts.length > 0 && (
            <WorkPanel
              title={t('queueReceipts')}
              count={data.awaitingReceipts}
              viewAllHref="/dashboard/payments"
              items={data.receipts}
              itemHref={() => '/dashboard/payments'}
            />
          )}
          {data.refunds.length > 0 && (
            <WorkPanel
              title={t('queueRefunds')}
              count={data.refundRequests}
              viewAllHref="/dashboard/refunds"
              items={data.refunds}
              itemHref={() => '/dashboard/refunds'}
            />
          )}
          {data.courses.length > 0 && (
            <WorkPanel
              title={t('queueCourses')}
              count={data.coursesInReview}
              viewAllHref="/dashboard/courses?status=in_review"
              items={data.courses}
              itemHref={(item) => `/dashboard/courses/${item.id}`}
            />
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {t('platformFacts', { courses: data.publishedCourses, students: data.students })}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The owner's money picture
// ---------------------------------------------------------------------------------------------

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-start font-medium">{children}</th>
}

/**
 * Who gets what. Students pay `gross`; the platform keeps `platform` and the doctors earn
 * `doctors`. Refunded orders are not in any of these numbers (they have their own line).
 */
export async function RevenueOverview({ data }: { data: PlatformRevenue }) {
  const [t, money, format, locale] = await Promise.all([
    getTranslations('dashboard.overview'),
    getMoneyFormatter(),
    getFormatter(),
    getLocale(),
  ])
  const doctorsPercent = data.gross === 0 ? 0 : Math.round((data.doctors / data.gross) * 100)
  const monthLabel = (month: string) =>
    format.dateTime(new Date(`${month}-15T12:00:00Z`), {
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Cairo',
    })

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">{t('revenueTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('revenueHelp')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t('gross')} value={money(data.gross)} hint={t('grossHint')} />
          <Stat
            label={t('platform')}
            value={money(data.platform)}
            tone="good"
            hint={t('platformHint')}
          />
          <Stat label={t('doctors')} value={money(data.doctors)} hint={t('doctorsHint')} />
          <Stat
            label={t('owed')}
            value={money(data.owed)}
            tone={data.owed < 0 ? 'bad' : undefined}
            hint={t('owedHint', { paid: money(data.paidOut) })}
          />
        </div>

        {data.gross > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div
              className="flex h-3 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={t('splitLabel', {
                doctors: doctorsPercent,
                platform: 100 - doctorsPercent,
              })}
            >
              <div className="bg-primary" style={{ width: `${100 - doctorsPercent}%` }} />
              <div className="bg-primary/35" style={{ width: `${doctorsPercent}%` }} />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                <span aria-hidden className="me-1 inline-block size-2 rounded-full bg-primary" />
                {t('platform')} · {100 - doctorsPercent}%
              </span>
              <span>
                <span aria-hidden className="me-1 inline-block size-2 rounded-full bg-primary/35" />
                {t('doctors')} · {doctorsPercent}%
              </span>
            </div>
          </div>
        )}

        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div className="flex justify-between gap-4 border-b py-1">
            <dt className="text-muted-foreground">{t('sales')}</dt>
            <dd className="font-medium">{data.sales}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b py-1">
            <dt className="text-muted-foreground">{t('free')}</dt>
            <dd className="font-medium">{data.freeEnrollments}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b py-1">
            <dt className="text-muted-foreground">{t('refunded')}</dt>
            <dd className="font-medium">
              {data.refundedCount} · {money(data.refundedAmount)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('byMonth')}</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted">
              <tr>
                <Th>{t('colMonth')}</Th>
                <Th>{t('sales')}</Th>
                <Th>{t('gross')}</Th>
                <Th>{t('platform')}</Th>
                <Th>{t('doctors')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.months.map((row) => (
                <tr key={row.month}>
                  <td className="px-4 py-3">{monthLabel(row.month)}</td>
                  <td className="px-4 py-3">{row.sales}</td>
                  <td className="px-4 py-3">{money(row.gross)}</td>
                  <td className="px-4 py-3 font-medium text-primary">{money(row.platform)}</td>
                  <td className="px-4 py-3">{money(row.doctors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{t('byDoctor')}</h2>
            <p className="text-sm text-muted-foreground">{t('byDoctorHelp')}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/earnings">{t('payoutsLink')}</Link>
          </Button>
        </div>
        {data.perDoctor.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            {t('noSales')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <Th>{t('colDoctor')}</Th>
                  <Th>{t('sales')}</Th>
                  <Th>{t('gross')}</Th>
                  <Th>{t('platform')}</Th>
                  <Th>{t('doctors')}</Th>
                  <Th>{t('paidOut')}</Th>
                  <Th>{t('owed')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.perDoctor.map((row) => (
                  <tr key={row.doctorId}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/earnings/${row.doctorId}`}
                        className="font-medium hover:text-primary"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.sales}</td>
                    <td className="px-4 py-3">{money(row.gross)}</td>
                    <td className="px-4 py-3 font-medium text-primary">{money(row.platform)}</td>
                    <td className="px-4 py-3">{money(row.doctors)}</td>
                    <td className="px-4 py-3">{money(row.paidOut)}</td>
                    <td
                      className={'px-4 py-3 font-bold ' + (row.owed < 0 ? 'text-destructive' : '')}
                    >
                      {money(row.owed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('byCourse')}</h2>
        {data.perCourse.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            {t('noSales')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <Th>{t('colCourse')}</Th>
                  <Th>{t('sales')}</Th>
                  <Th>{t('gross')}</Th>
                  <Th>{t('platform')}</Th>
                  <Th>{t('doctors')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.perCourse.slice(0, 10).map((row) => (
                  <tr key={row.courseId}>
                    <td className="px-4 py-3">{pick(row.title, locale as 'ar' | 'en')}</td>
                    <td className="px-4 py-3">{row.sales}</td>
                    <td className="px-4 py-3">{money(row.gross)}</td>
                    <td className="px-4 py-3 font-medium text-primary">{money(row.platform)}</td>
                    <td className="px-4 py-3">{money(row.doctors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// A doctor's own numbers
// ---------------------------------------------------------------------------------------------

export async function DoctorHome({ data }: { data: DoctorOverview }) {
  const [t, tStatus, money] = await Promise.all([
    getTranslations('dashboard.overview'),
    getTranslations('dashboard.status'),
    getMoneyFormatter(),
  ])
  const { earnings } = data
  const negative = earnings.balance < 0

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('doctorEarned')} value={money(earnings.totalEarned)} />
        <Stat label={t('doctorPaid')} value={money(earnings.totalPaidOut)} />
        <Stat
          label={t('doctorOwed')}
          value={money(earnings.balance)}
          tone={negative ? 'bad' : 'good'}
        />
        <Stat label={t('doctorStudents')} value={String(data.studentsEnrolled)} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold">{t('myCourses')}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/courses">{t('manageCourses')}</Link>
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {(['published', 'in_review', 'draft', 'archived'] as const).map((status) => (
            <li key={status} className="rounded-full border bg-card px-3 py-1 text-sm">
              {tStatus(status)} · <span className="font-bold">{data.courses[status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold">{t('recentSales')}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/earnings">{t('allEarnings')}</Link>
          </Button>
        </div>
        {data.recentSales.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            {t('noDoctorSales')}
          </p>
        ) : (
          <SalesTable rows={data.recentSales} />
        )}
      </section>
    </div>
  )
}
