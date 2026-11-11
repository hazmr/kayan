import { getLocale, getTranslations } from 'next-intl/server'

import { CourseGrid } from '@/components/courses/CourseCard'
import { Link } from '@/i18n/navigation'
import { listCategories, listPublishedCourses } from '@/lib/catalog'

interface PageProps {
  searchParams: Promise<{ category?: string | string[] }>
}

function FilterLink({ slug, title, active }: { slug?: string; title: string; active: boolean }) {
  return (
    <Link
      href={slug ? { pathname: '/courses', query: { category: slug } } : '/courses'}
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
  const [{ category }, locale, t] = await Promise.all([
    searchParams,
    getLocale(),
    getTranslations('courses'),
  ])
  const selected = typeof category === 'string' && category !== '' ? category : undefined

  const [categories, courses] = await Promise.all([
    listCategories(locale),
    listPublishedCourses({ locale, categorySlug: selected }),
  ])

  // Subcategories are shown for the selected main category, or for the parent of a selected subcategory.
  const openCategory = categories.find(
    (node) => node.slug === selected || node.children.some((child) => child.slug === selected),
  )

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <nav className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterLink title={t('all')} active={!selected} />
          {categories.map((node) => (
            <FilterLink
              key={node.slug}
              slug={node.slug}
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
                slug={child.slug}
                title={child.title}
                active={child.slug === selected}
              />
            ))}
          </div>
        )}
      </nav>

      {courses.length > 0 ? (
        <CourseGrid courses={courses} />
      ) : (
        <p className="py-12 text-center text-muted-foreground">{t('empty')}</p>
      )}
    </section>
  )
}
