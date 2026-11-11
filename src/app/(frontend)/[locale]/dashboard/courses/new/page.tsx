import { getTranslations } from 'next-intl/server'

import { isStaff } from '@/access/roles'
import { CourseForm } from '@/components/dashboard/CourseForm'
import { listCategoryOptions, listDoctors } from '@/lib/dashboard/queries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

export default async function NewCoursePage() {
  const user = await requireDashboardUser()
  const [t, categories, doctors] = await Promise.all([
    getTranslations('dashboard.course'),
    listCategoryOptions(),
    listDoctors(user),
  ])

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
      <div className="rounded-xl border bg-card p-4 md:p-6">
        <CourseForm categories={categories} doctors={doctors} mustPickDoctor={isStaff(user)} />
      </div>
    </section>
  )
}
