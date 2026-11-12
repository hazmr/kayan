import { CircleCheck, Lock, Play } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'
import type { WatchModule } from '@/lib/catalog/watch'

/** The course outline next to the player. Lessons you can watch are links; the rest show a lock. */
export async function WatchSidebar({
  modules,
  courseSlug,
  currentId,
  completedIds,
}: {
  modules: WatchModule[]
  courseSlug: string
  currentId: string
  /** Lessons this student has completed. Empty for people who do not track progress. */
  completedIds: string[]
}) {
  const done = new Set(completedIds)
  const t = await getTranslations('watch')

  return (
    <nav aria-label={t('contents')} className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{t('contents')}</h2>
      {modules.map((courseModule) => (
        <div key={courseModule.id} className="overflow-hidden rounded-xl border bg-card">
          <h3 className="bg-muted px-4 py-2 text-sm font-semibold">{courseModule.title}</h3>
          <ul className="divide-y">
            {courseModule.lessons.map((lesson) => {
              const current = lesson.id === currentId
              const row = (
                <>
                  {done.has(lesson.id) ? (
                    <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
                  ) : lesson.watchable ? (
                    <Play className="size-4 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={current ? 'font-semibold' : undefined}>{lesson.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t('minutes', {
                        count: Math.max(1, Math.round(lesson.durationSeconds / 60)),
                      })}
                      {lesson.isFreePreview && (
                        <Badge variant="secondary">{t('freePreview')}</Badge>
                      )}
                      {!lesson.watchable && <span className="sr-only">{t('lockedLesson')}</span>}
                      {done.has(lesson.id) && <span className="sr-only">{t('completed')}</span>}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={lesson.id} className={current ? 'bg-primary/5' : undefined}>
                  {lesson.watchable ? (
                    <Link
                      href={`/courses/${courseSlug}/lessons/${lesson.id}`}
                      aria-current={current ? 'page' : undefined}
                      className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-muted"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-4 py-3 text-sm text-muted-foreground">
                      {row}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
