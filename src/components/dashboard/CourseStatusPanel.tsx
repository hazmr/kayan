'use client'

import { useTranslations } from 'next-intl'

import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import { sendJson } from '@/lib/api/postJson'
import type { CourseStatus } from '@/lib/courses/transitions'

import { StatusBadge, useApiAction } from './shared'

type ActionPath = 'publish' | 'archive' | 'unarchive'

/** One entry per arrow in the course status diagram, keyed "from>to". */
const ACTIONS: Partial<Record<`${CourseStatus}>${CourseStatus}`, ActionPath>> = {
  'draft>published': 'publish',
  'published>archived': 'archive',
  'archived>published': 'unarchive',
}

interface CourseStatusPanelProps {
  courseId: string
  status: CourseStatus
  /** Statuses this person may move the course to. Decided on the server. */
  moveTo: CourseStatus[]
  /** What is still missing before the course can be published. */
  missing: { category: boolean; thumbnail: boolean; lesson: boolean }
}

/**
 * The top of the course page: where the course stands, what that means,
 * and one button for each thing that can happen next.
 */
export function CourseStatusPanel({ courseId, status, moveTo, missing }: CourseStatusPanelProps) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode } = useApiAction()
  const incomplete = missing.category || missing.thumbnail || missing.lesson

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <StatusBadge status={status} />
          <p className="text-sm text-muted-foreground">{t(`statusHelp.${status}`)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {moveTo.map((to) => {
            const path = ACTIONS[`${status}>${to}`]
            if (!path) return null
            return (
              <Button
                key={path}
                variant={path === 'archive' ? 'outline' : 'default'}
                disabled={pending || (path === 'publish' && incomplete)}
                onClick={() =>
                  void run(() => sendJson('POST', `/api/courses/${courseId}/${path}`, {}))
                }
              >
                {t(`actions.${path}`)}
              </Button>
            )
          })}
        </div>
      </div>

      <FormError code={errorCode} />

      {status === 'draft' && incomplete && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium">{t('course.checklistTitle')}</p>
          <ul className="list-inside list-disc text-muted-foreground">
            {missing.category && <li>{t('course.checkCategory')}</li>}
            {missing.thumbnail && <li>{t('course.checkThumbnail')}</li>}
            {missing.lesson && <li>{t('course.checkLesson')}</li>}
          </ul>
        </div>
      )}
    </section>
  )
}
