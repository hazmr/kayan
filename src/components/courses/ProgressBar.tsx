import { useTranslations } from 'next-intl'

import type { CourseProgress } from '@/lib/progress/calculate'

/** "3 of 10 lessons" with a bar. Works in server and client components. */
export function ProgressBar({ progress, label }: { progress: CourseProgress; label: string }) {
  const t = useTranslations('progress')
  const done = progress.total > 0 && progress.completed === progress.total
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t('count', { done: progress.completed, total: progress.total })}</span>
        <span className={done ? 'font-semibold text-primary' : undefined}>
          {done ? t('complete') : `${progress.percent}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}
