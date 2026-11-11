'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { sendJson } from '@/lib/api/postJson'

import { useApiAction } from './shared'

/** A one-click Unarchive in the course list, so staff do not have to hunt for it. */
export function UnarchiveButton({ courseId }: { courseId: string }) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode } = useApiAction()

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => void run(() => sendJson('POST', `/api/courses/${courseId}/unarchive`, {}))}
      >
        {t('actions.unarchive')}
      </Button>
      {errorCode && (
        <span className="text-xs text-destructive">{t('courses.unarchiveFailed')}</span>
      )}
    </span>
  )
}
