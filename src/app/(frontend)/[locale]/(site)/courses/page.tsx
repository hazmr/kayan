import { Search } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'

import { CatalogPager } from '@/components/courses/CatalogPager'
import { CourseGrid } from '@/components/courses/CourseCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link } from '@/i18n/navigation'
import { listCategories, searchPublishedCourses } from '@/lib/catalog'
import {
  CATALOG_PRICES,
  CATALOG_SORTS,
  cleanSearch,
  parsePage,
  parsePrice,
  parseSort,
} from '@/lib/catalog/params'

interface PageProps {
  searchParams: Promise<{
    category?: string | string[]
    q?: string | string[]
    sort?: string | string[]
    price?: string | string[]
    page?: string | string[]
  }>
}

const selectClass =
  'h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

type Query = Record<string, string | undefined>

function FilterLink({ query, title, active }: { query: Query; title: string; active: boolean }) {
  const clean = Object.fromEntries(Object.entries(query).filter(([, value]) => value))
  return (
    <Link
      href={{ pathname: '/courses', query: clean }}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground'
          : 'rounded-full border px-3 py-1 text-sm hover:bg-muted'
      }
    >
      {title}
    </Link>
  )
}

export default async function CoursesPage({ searchParams }: PageProps) {
  const [raw, locale, t] = await Promise.all([
    searchParams,
    getLocale(),
    getTranslations('courses'),
  ])
  const category =
    typeof raw.category === 'string' && raw.category !== '' ? raw.category : undefined
  const search = cleanSearch(raw.q)
  const sort = parseSort(raw.sort)
  const price = parsePrice(raw.price)
  const page = parsePage(raw.page)

  const [categories, result] = await Promise.all([
    listCategories(locale),
    searchPublishedCourses({ locale, categorySlug: category, search, sort, price, page }),
  ])

  // What stays in the address when a filter link is clicked: the search and the other choices,
  // but never the page number (a new filter starts again at page 1).
  const keep: Query = {
    q: search || undefined,
    sort: sort === 'newest' ? undefined : sort,
    price: price === 'all' ? undefined : price,
  }
  const filtered = category !== undefined || search !== '' || price !== 'all'

  // Subcategories are shown for the selected main category, or for the parent of a selected subcategory.
  const openCategory = categories.find(
    (node) => node.slug === category || node.children.some((child) => child.slug === category),
  )

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* A plain GET form: the choices go into the address, so a filtered view can be shared. */}
      <form
        method="get"
        role="search"
        className="flex flex-wrap items-center gap-2"
        aria-label={t('searchLabel')}
      >
        {category && <input type="hidden" name="category" value={category} />}
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            type="search"
            defaultValue={search}
            maxLength={80}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="h-9 ps-9"
          />
        </div>
        <select
          name="price"
          defaultValue={price}
          aria-label={t('priceLabel')}
          className={selectClass}
        >
          {CATALOG_PRICES.map((value) => (
            <option key={value} value={value}>
              {t(`price.${value}`)}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} aria-label={t('sortLabel')} className={selectClass}>
          {CATALOG_SORTS.map((value) => (
            <option key={value} value={value}>
              {t(`sort.${value}`)}
            </option>
          ))}
        </select>
        <Button type="submit">{t('searchButton')}</Button>
      </form>

      <nav className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterLink query={keep} title={t('all')} active={!category} />
          {categories.map((node) => (
            <FilterLink
              key={node.slug}
              query={{ ...keep, category: node.slug }}
              title={node.title}
              active={node.slug === openCategory?.slug}
            />
          ))}
        </div>
        {openCategory && openCategory.children.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {openCategory.children.map((child) => (
              <FilterLink
                key={child.slug}
                query={{ ...keep, category: child.slug }}
                title={child.title}
                active={child.slug === category}
              />
            ))}
          </div>
        )}
      </nav>

      {filtered && (
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {t('resultCount', { count: result.totalDocs })}
          <Link href="/courses" className="text-primary underline-offset-4 hover:underline">
            {t('clearFilters')}
          </Link>
        </p>
      )}

      {result.courses.length > 0 ? (
        <CourseGrid courses={result.courses} />
      ) : (
        <p className="py-12 text-center text-muted-foreground">
          {filtered ? t('noResults') : t('empty')}
        </p>
      )}

      <CatalogPager
        page={result.page}
        totalPages={result.totalPages}
        pathname="/courses"
        query={{ ...keep, category }}
      />
    </section>
  )
}
