import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { CourseForm } from '@/components/dashboard/CourseForm'
import { CourseStatusPanel } from '@/components/dashboard/CourseStatusPanel'
import { CurriculumEditor } from '@/components/dashboard/CurriculumEditor'
import { pick } from '@/lib/dashboard/localized'
import { Link } from '@/i18n/navigation'
import { getCourseForEdit, listCategoryOptions, listDoctors } from '@/lib/dashboard/queries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

interface PageProps {
  params: Promise<{ id: string }>
}

// The whole course on one screen: where it stands, its details, and its modules and lessons.
export default async function EditCoursePage({ params }: PageProps) {
  const [user, { id }, locale, t] = await Promise.all([
    requireDashboardUser(),
    params,
    getLocale(),
    getTranslations('dashboard'),
  ])
  const course = await getCourseForEdit(user, id)
  if (!course) notFound()

  const [categories, doctors] = await Promise.all([listCategoryOptions(), listDoctors(user)])
  const hasLesson = course.modules.some((courseModule) => courseModule.lessons.length > 0)

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{pick(course.title, locale)}</h1>
        {course.status === 'published' && (
          <Link
            href={`/courses/${course.slug}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t('courses.viewLive')}
          </Link>
        )}
      </div>

      <CourseStatusPanel
        courseId={course.id}
        status={course.status}
        moveTo={course.can.moveTo}
        missing={{
          category: course.categoryId === '',
          thumbnail: course.thumbnail === null,
          lesson: !hasLesson,
        }}
      />

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
        <h2 className="text-lg font-bold">{t('course.detailsTitle')}</h2>
        {/* The key resets the form's fields whenever the saved course changes. */}
        <CourseForm
          key={`${course.id}-${course.status}`}
          course={course}
          categories={categories}
          doctors={doctors}
          mustPickDoctor={false}
        />
      </div>

      <CurriculumEditor courseId={course.id} modules={course.modules} />
    </section>
  )
}
