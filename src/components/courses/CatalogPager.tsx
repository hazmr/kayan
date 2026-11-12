import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

/** Previous / Next with "Page 2 of 5", for any list whose position lives in the address. */
export async function CatalogPager({
  page,
  totalPages,
  pathname,
  query,
}: {
  page: number
  totalPages: number
  pathname: '/courses' | '/dashboard/courses'
  /** Everything else in the address (search, sort, filters). The page number is added here. */
  query: Record<string, string | undefined>
}) {
  const t = await getTranslations('pager')
  if (totalPages <= 1) return null

  const hrefFor = (target: number) => {
    const clean = Object.fromEntries(
      Object.entries({ ...query, page: target === 1 ? undefined : String(target) }).filter(
        ([, value]) => value !== undefined && value !== '',
      ),
    )
    return { pathname, query: clean }
  }

  return (
    <nav aria-label={t('label')} className="flex items-center justify-between gap-4 pt-2 text-sm">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(page - 1)}>← {t('previous')}</Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">{t('position', { page, total: totalPages })}</span>
      {page < totalPages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(page + 1)}>{t('next')} →</Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  )
}
