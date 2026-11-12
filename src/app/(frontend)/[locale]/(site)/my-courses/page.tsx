import { getLocale, getTranslations } from 'next-intl/server'

import { MyCourseCard } from '@/components/courses/MyCourseCard'
import { Button } from '@/components/ui/button'
import { Link, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { listMyCourses } from '@/lib/enrollments/myCourses'

export default async function MyCoursesPage() {
  const [locale, user, t] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    getTranslations('myCourses'),
  ])
  if (!user) {
    return redirect({ href: { pathname: '/login', query: { next: '/my-courses' } }, locale })
  }
  // Learning is for student accounts; everyone else works from the dashboard.
  if (user.role !== 'student') return redirect({ href: '/dashboard', locale })
  const courses = await listMyCourses(user, locale)

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{t('empty')}</p>
          <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
          <Button asChild>
            <Link href="/courses">{t('browse')}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <MyCourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </section>
  )
}
