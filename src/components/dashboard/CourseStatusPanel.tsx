'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendJson } from '@/lib/api/postJson'
import type { CourseStatus } from '@/lib/courses/transitions'

import { StatusBadge, useApiAction } from './shared'

type ActionPath = 'submit' | 'publish' | 'send-back' | 'archive' | 'unarchive'

/** One entry per arrow in the course status diagram, keyed "from>to". */
const ACTIONS: Partial<Record<`${CourseStatus}>${CourseStatus}`, ActionPath>> = {
  'draft>in_review': 'submit',
  'in_review>published': 'publish',
  'in_review>draft': 'send-back',
  'published>archived': 'archive',
  'archived>published': 'unarchive',
}

interface CourseStatusPanelProps {
  courseId: string
  status: CourseStatus
  reviewNote: string
  /** Statuses this person may move the course to. Decided on the server. */
  moveTo: CourseStatus[]
  /** What is still missing before the course can be sent for review. */
  missing: { category: boolean; thumbnail: boolean; lesson: boolean }
}

/**
 * The top of the course page: where the course stands, what that means,
 * and one button for each thing this person can do next.
 */
export function CourseStatusPanel({
  courseId,
  status,
  reviewNote,
  moveTo,
  missing,
}: CourseStatusPanelProps) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode, clearError } = useApiAction()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const incomplete = missing.category || missing.thumbnail || missing.lesson

  function call(path: ActionPath, body?: Record<string, unknown>) {
    return run(() => sendJson('POST', `/api/courses/${courseId}/${path}`, body ?? {}))
  }

  async function sendBack() {
    const result = await call('send-back', { note })
    if (result.ok) {
      setNoteOpen(false)
      setNote('')
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <StatusBadge status={status} />
          <p className="text-sm text-muted-foreground">
            {status === 'archived' && moveTo.includes('published')
              ? t('statusHelpStaff.archived')
              : t(`statusHelp.${status}`)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {moveTo.map((to) => {
            const path = ACTIONS[`${status}>${to}`]
            if (!path) return null
            if (path === 'send-back') {
              return (
                <Button
                  key={path}
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    clearError()
                    setNoteOpen(true)
                  }}
                >
                  {t(`actions.${path}`)}
                </Button>
              )
            }
            return (
              <Button
                key={path}
                variant={path === 'archive' ? 'outline' : 'default'}
                disabled={pending || (path === 'submit' && incomplete)}
                onClick={() => void call(path)}
              >
                {t(`actions.${path}`)}
              </Button>
            )
          })}
        </div>
      </div>

      {!noteOpen && <FormError code={errorCode} />}

      {reviewNote !== '' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">{t('course.reviewNote')}</p>
          <p className="whitespace-pre-line">{reviewNote}</p>
        </div>
      )}

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

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('actions.noteTitle')}</DialogTitle>
            <DialogDescription>{t('actions.noteHelp')}</DialogDescription>
          </DialogHeader>
          <FormError code={errorCode} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-note">{t('actions.noteLabel')}</Label>
            <Textarea
              id="review-note"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNoteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={pending || note.trim() === ''} onClick={sendBack}>
              {t('actions.send-back')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
