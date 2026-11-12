'use client'

import { CircleCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import { sendJson } from '@/lib/api/postJson'
import { useApiAction } from '@/lib/api/useApiAction'

/** "Mark as complete" under the player. Pressing it again takes the mark back. */
export function LessonCompleteButton({
  lessonId,
  completed,
}: {
  lessonId: string
  completed: boolean
}) {
  const t = useTranslations('watch')
  const { run, pending, errorCode } = useApiAction()

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={completed ? 'outline' : 'default'}
        disabled={pending}
        aria-pressed={completed}
        onClick={() =>
          void run(() =>
            sendJson('POST', '/api/lesson-progress/set', { lessonId, completed: !completed }),
          )
        }
        className="self-start"
      >
        <CircleCheck aria-hidden />
        {completed ? t('completedUndo') : t('markComplete')}
      </Button>
      <FormError code={errorCode} />
    </div>
  )
}
