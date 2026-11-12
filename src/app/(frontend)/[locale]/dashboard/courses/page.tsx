import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import { isStaff } from '@/access/roles'
import { StatusBadge } from '@/components/dashboard/shared'
import { UnarchiveButton } from '@/components/dashboard/CourseRowAction'
import { pick } from '@/lib/dashboard/localized'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { COURSE_STATUSES, type CourseStatus } from '@/lib/courses/transitions'
import { CatalogPager } from '@/components/courses/CatalogPager'
import { Input } from '@/components/ui/input'
import { cleanSearch, parsePage } from '@/lib/catalog/params'
import { searchCourses } from '@/lib/dashboard/queries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

interface PageProps {
  searchParams: Promise<{
    status?: string | string[]
    q?: string | string[]
    page?: string | string[]
  }>
}

function toStatus(value: string | string[] | undefined): CourseStatus | undefined {
  return COURSE_STATUSES.find((status) => status === value)
}

export default async function DashboardCoursesPage({ searchParams }: PageProps) {
  const [user, raw, locale, t, format] = await Promise.all([
    requireDashboardUser(),
    searchParams,
    getLocale(),
    getTranslations('dashboard'),
    getFormatter(),
  ])
  const selected = toStatus(raw.status)
  const search = cleanSearch(raw.q)
  const staff = isStaff(user)
  const { rows: courses, ...paging } = await searchCourses(user, {
    status: selected,
    search,
    page: parsePage(raw.page),
  })

  const tabs: { status?: CourseStatus; label: string }[] = [
    { label: t('courses.all') },
    ...COURSE_STATUSES.map((value) => ({ status: value, label: t(`status.${value}`) })),
  ]

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{staff ? t('courses.title') : t('courses.mine')}</h1>
        <Button asChild>
          <Link href="/dashboard/courses/new">{t('courses.new')}</Link>
        </Button>
      </div>

      <form method="get" role="search" className="flex gap-2">
        {selected && <input type="hidden" name="status" value={selected} />}
        <Input
          name="q"
          type="search"
          defaultValue={search}
          maxLength={80}
          placeholder={staff ? t('courses.searchStaff') : t('courses.searchMine')}
          aria-label={staff ? t('courses.searchStaff') : t('courses.searchMine')}
        />
        <Button type="submit" variant="outline">
          {t('common.search')}
        </Button>
      </form>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.status === selected
          return (
            <Link
              key={tab.status ?? 'all'}
              href={{
                pathname: '/dashboard/courses',
                query: {
                  ...(tab.status ? { status: tab.status } : {}),
                  ...(search ? { q: search } : {}),
                },
              }}
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

      {selected === 'archived' && staff && (
        <p className="text-sm text-muted-foreground">{t('courses.archivedHint')}</p>
      )}

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="font-medium">{search ? t('courses.noMatch') : t('courses.empty')}</p>
          {!selected && !search && (
            <p className="text-sm text-muted-foreground">{t('courses.emptyHint')}</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t('courses.colTitle')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('courses.colStatus')}</th>
                {staff && (
                  <th className="px-4 py-2 text-start font-medium">{t('courses.colDoctor')}</th>
                )}
                <th className="px-4 py-2 text-start font-medium">{t('courses.colPrice')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/dashboard/courses/${course.id}`} className="hover:text-primary">
                      {pick(course.title, locale)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={course.status} />
                  </td>
                  {staff && <td className="px-4 py-3">{course.ownerName}</td>}
                  <td className="px-4 py-3">
                    {course.priceEgp === 0
                      ? t('courses.free')
                      : format.number(course.priceEgp, {
                          style: 'currency',
                          currency: 'EGP',
                          maximumFractionDigits: 0,
                        })}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <span className="inline-flex items-start gap-2">
                      {staff && course.status === 'archived' && (
                        <UnarchiveButton courseId={course.id} />
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/courses/${course.id}`}>{t('courses.open')}</Link>
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPager
        page={paging.page}
        totalPages={paging.totalPages}
        pathname="/dashboard/courses"
        query={{ status: selected, q: search || undefined }}
      />
    </section>
  )
}
