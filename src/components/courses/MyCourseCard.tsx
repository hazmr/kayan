import { useTranslations } from 'next-intl'
import Image from 'next/image'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { MyCourse } from '@/lib/enrollments/myCourses'

export function MyCourseCard({ course }: { course: MyCourse }) {
  const t = useTranslations('myCourses')
  const learnHref = course.firstLessonId
    ? `/courses/${course.slug}/lessons/${course.firstLessonId}`
    : `/courses/${course.slug}`

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-video bg-muted">
        {course.thumbnail && (
          <Image
            src={course.thumbnail.url}
            alt={course.thumbnail.alt}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="leading-snug font-semibold">{course.title}</h2>
          <p className="text-sm text-muted-foreground">{t('by', { name: course.doctorName })}</p>
          <p className="text-xs text-muted-foreground">
            {t('lessons', { count: course.lessonCount })}
          </p>
        </div>
        {course.archived && (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="self-start">
              {t('archivedNote')}
            </Badge>
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Button asChild>
            <Link href={learnHref}>{t('continue')}</Link>
          </Button>
          <Link
            href={`/courses/${course.slug}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t('coursePage')}
          </Link>
        </div>
      </div>
    </article>
  )
}
