import { getLocale, getTranslations } from 'next-intl/server'

import { CourseGrid } from '@/components/courses/CourseCard'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { listPublishedCourses } from '@/lib/catalog'

export default async function HomePage() {
  const locale = await getLocale()
  const [t, tCourses, user, courses] = await Promise.all([
    getTranslations('home'),
    getTranslations('courses'),
    getCurrentUser(),
    listPublishedCourses({ locale, limit: 6 }),
  ])

  return (
    <>
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center">
        {user && (
          <p className="text-sm font-medium text-primary">{t('welcome', { name: user.name })}</p>
        )}
        <h1 className="text-3xl leading-snug font-bold sm:text-4xl">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('subtitle')}</p>

        {!user && (
          <div className="flex flex-col items-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">{t('getStarted')}</Link>
            </Button>
            <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
              {t('haveAccount')}
            </Link>
          </div>
        )}
      </section>

      {courses.length > 0 && (
        <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">{tCourses('newest')}</h2>
            <Link
              href="/courses"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {tCourses('viewAll')}
            </Link>
          </div>
          <CourseGrid courses={courses} />
        </section>
      )}
    </>
  )
}
