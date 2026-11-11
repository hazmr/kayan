import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { Lock, Play } from 'lucide-react'
import { notFound } from 'next/navigation'

import { Link } from '@/i18n/navigation'
import { CoursePrice } from '@/components/courses/CoursePrice'
import { PurchaseBox } from '@/components/courses/PurchaseBox'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { getPublishedCourse, hasFullAccessTo } from '@/lib/catalog'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()])
  const course = await getPublishedCourse(slug, locale)
  return course ? { title: `${course.title} | Vetudy`, description: course.description } : {}
}

export default async function CoursePage({ params }: PageProps) {
  const [{ slug }, locale, t, user] = await Promise.all([
    params,
    getLocale(),
    getTranslations('courses'),
    getCurrentUser(),
  ])
  const course = await getPublishedCourse(slug, locale)
  // Drafts, courses in review, and archived courses look exactly like a missing page.
  if (!course) notFound()

  const totalMinutes = Math.round(course.totalSeconds / 60)
  const fullAccess = await hasFullAccessTo(user, course)
  const firstLessonId = course.modules.flatMap((courseModule) => courseModule.lessons)[0]?.id

  return (
    <article className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          {course.categoryTitle && (
            <span className="text-sm text-muted-foreground">{course.categoryTitle}</span>
          )}
          <h1 className="text-3xl leading-snug font-bold">{course.title}</h1>
          <p className="text-muted-foreground">
            {t('instructor')}: {course.ownerName}
          </p>
        </header>

        <p className="leading-relaxed whitespace-pre-line">{course.description}</p>

        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-bold">{t('outline')}</h2>
            <span className="text-sm text-muted-foreground">
              {t('lessonCount', { count: course.lessonCount })} ·{' '}
              {t('minutes', { count: totalMinutes })}
            </span>
          </div>

          {course.modules.map((courseModule) => (
            <div key={courseModule.id} className="overflow-hidden rounded-xl border">
              <h3 className="bg-muted px-4 py-3 font-semibold">{courseModule.title}</h3>
              <ul className="divide-y">
                {courseModule.lessons.map((lesson) => {
                  // Open to anyone for a free preview, to everyone for owners, staff, and students.
                  const watchable = fullAccess || lesson.isFreePreview
                  const row = (
                    <>
                      <span className="flex flex-wrap items-center gap-2">
                        {watchable ? (
                          <Play className="size-4 text-primary" aria-hidden />
                        ) : (
                          <Lock className="size-4 text-muted-foreground" aria-hidden />
                        )}
                        {lesson.title}
                        {lesson.isFreePreview && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {t('freePreview')}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {t('minutes', {
                          count: Math.max(1, Math.round(lesson.durationSeconds / 60)),
                        })}
                      </span>
                    </>
                  )
                  return (
                    <li key={lesson.id}>
                      {watchable ? (
                        <Link
                          href={`/courses/${course.slug}/lessons/${lesson.id}`}
                          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted"
                        >
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-4 px-4 py-3 text-muted-foreground">
                          {row}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <aside className="flex h-fit flex-col gap-4 overflow-hidden rounded-xl border bg-card lg:sticky lg:top-6">
        <div className="relative aspect-video bg-muted">
          {course.thumbnail && (
            <Image
              src={course.thumbnail.url}
              alt={course.thumbnail.alt}
              fill
              priority
              sizes="(min-width: 1024px) 320px, 100vw"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <CoursePrice priceEgp={course.priceEgp} className="text-2xl font-bold text-primary" />
          <PurchaseBox
            courseId={course.id}
            slug={course.slug}
            priceEgp={course.priceEgp}
            user={user}
            firstLessonId={firstLessonId}
          />
        </div>
      </aside>
    </article>
  )
}
