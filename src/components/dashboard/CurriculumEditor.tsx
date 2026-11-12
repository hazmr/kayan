'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendJson, type ApiResult } from '@/lib/api/postJson'
import type { LessonEdit, Localized, ModuleEdit } from '@/lib/dashboard/types'
import { parseBunnyId } from '@/lib/video/parseBunnyId'
import { parseYouTubeId } from '@/lib/video/parseYouTubeId'

import { ConfirmDelete, LocalizedField, useApiAction } from './shared'
import { localizedPayload, selectClass, pick } from '@/lib/dashboard/localized'

const EMPTY: Localized = { ar: '', en: '' }

type Editing =
  | { kind: 'module'; module?: ModuleEdit }
  | { kind: 'lesson'; moduleId: string; lesson?: LessonEdit }
  | null

/**
 * Saves a new order for a list of siblings. Positions are rewritten as 1, 2, 3...
 * and only the rows whose number actually changed are sent.
 */
async function saveOrder(
  collection: 'modules' | 'lessons',
  ordered: { id: string; position: number }[],
): Promise<ApiResult> {
  let last: ApiResult = { ok: true, data: null }
  for (const [index, item] of ordered.entries()) {
    if (item.position === index + 1) continue
    last = await sendJson('PATCH', `/api/${collection}/${item.id}?depth=0`, { position: index + 1 })
    if (!last.ok) return last
  }
  return last
}

function moved<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const copy = [...list]
  const target = index + direction
  const item = copy[index]
  const other = copy[target]
  if (item === undefined || other === undefined) return copy
  copy[index] = other
  copy[target] = item
  return copy
}

export function CurriculumEditor({
  courseId,
  modules,
  providers,
}: {
  courseId: string
  modules: ModuleEdit[]
  /** The video hosts that are set up (decided on the server from .env). */
  providers: LessonEdit['videoProvider'][]
}) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const { run, pending, errorCode } = useApiAction()
  const [editing, setEditing] = useState<Editing>(null)

  function reorderModules(index: number, direction: -1 | 1) {
    void run(() => saveOrder('modules', moved(modules, index, direction)))
  }

  function reorderLessons(lessons: LessonEdit[], index: number, direction: -1 | 1) {
    void run(() => saveOrder('lessons', moved(lessons, index, direction)))
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{t('curriculum.title')}</h2>
        <Button type="button" onClick={() => setEditing({ kind: 'module' })}>
          {t('curriculum.addModule')}
        </Button>
      </div>

      {!editing && <FormError code={errorCode} />}

      {modules.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t('curriculum.noModules')}
        </p>
      )}

      {modules.map((courseModule, moduleIndex) => (
        <div key={courseModule.id} className="overflow-hidden rounded-xl border">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted px-4 py-2">
            <h3 className="font-semibold">{pick(courseModule.title, locale)}</h3>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('common.moveUp')}
                disabled={pending || moduleIndex === 0}
                onClick={() => reorderModules(moduleIndex, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('common.moveDown')}
                disabled={pending || moduleIndex === modules.length - 1}
                onClick={() => reorderModules(moduleIndex, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing({ kind: 'module', module: courseModule })}
              >
                {t('common.edit')}
              </Button>
              <ConfirmDelete
                label={t('common.delete')}
                body={t('curriculum.deleteModuleBody')}
                onConfirm={() => sendJson('DELETE', `/api/modules/${courseModule.id}`)}
              />
            </div>
          </div>

          <ul className="divide-y">
            {courseModule.lessons.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                {t('curriculum.noLessons')}
              </li>
            )}
            {courseModule.lessons.map((lesson, lessonIndex) => (
              <li
                key={lesson.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {pick(lesson.title, locale)}
                  <span className="text-muted-foreground">
                    {t('curriculum.duration', {
                      minutes: Math.max(1, Math.round(lesson.durationSeconds / 60)),
                    })}
                  </span>
                  {lesson.isFreePreview && (
                    <Badge variant="secondary">{t('curriculum.freePreview')}</Badge>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('common.moveUp')}
                    disabled={pending || lessonIndex === 0}
                    onClick={() => reorderLessons(courseModule.lessons, lessonIndex, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('common.moveDown')}
                    disabled={pending || lessonIndex === courseModule.lessons.length - 1}
                    onClick={() => reorderLessons(courseModule.lessons, lessonIndex, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditing({ kind: 'lesson', moduleId: courseModule.id, lesson })
                    }
                  >
                    {t('common.edit')}
                  </Button>
                  <ConfirmDelete
                    label={t('common.delete')}
                    onConfirm={() => sendJson('DELETE', `/api/lessons/${lesson.id}`)}
                  />
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t px-4 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing({ kind: 'lesson', moduleId: courseModule.id })}
            >
              {t('curriculum.addLesson')}
            </Button>
          </div>
        </div>
      ))}

      {editing?.kind === 'module' && (
        <ModuleDialog
          courseId={courseId}
          module={editing.module}
          nextPosition={modules.length + 1}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'lesson' && (
        <LessonDialog
          providers={providers}
          moduleId={editing.moduleId}
          lesson={editing.lesson}
          nextPosition={
            (modules.find((item) => item.id === editing.moduleId)?.lessons.length ?? 0) + 1
          }
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

function ModuleDialog({
  courseId,
  module: existing,
  nextPosition,
  onClose,
}: {
  courseId: string
  module?: ModuleEdit
  nextPosition: number
  onClose: () => void
}) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode } = useApiAction()
  const [title, setTitle] = useState<Localized>(existing?.title ?? EMPTY)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() =>
      existing
        ? sendJson('PATCH', `/api/modules/${existing.id}?locale=all&depth=0`, {
            title: localizedPayload(title),
          })
        : sendJson('POST', '/api/modules?locale=all&depth=0', {
            title: localizedPayload(title),
            course: courseId,
            position: nextPosition,
          }),
    )
    if (result.ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? t('curriculum.editModule') : t('curriculum.newModule')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormError code={errorCode} />
          <LocalizedField
            id="module-title"
            label={t('curriculum.moduleTitle')}
            value={title}
            onChange={setTitle}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Provider = LessonEdit['videoProvider']

function LessonDialog({
  providers,
  moduleId,
  lesson,
  nextPosition,
  onClose,
}: {
  /** The video hosts that are set up. Bunny appears once its keys are in .env. */
  providers: Provider[]
  moduleId: string
  lesson?: LessonEdit
  nextPosition: number
  onClose: () => void
}) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode } = useApiAction()
  const [title, setTitle] = useState<Localized>(lesson?.title ?? EMPTY)
  const [provider, setProvider] = useState<Provider>(
    lesson?.videoProvider ?? (providers.includes('bunny') ? 'bunny' : 'youtube'),
  )
  const [video, setVideo] = useState(lesson?.videoId ?? '')
  const [minutes, setMinutes] = useState(String(Math.floor((lesson?.durationSeconds ?? 0) / 60)))
  const [seconds, setSeconds] = useState(String((lesson?.durationSeconds ?? 0) % 60))
  const [isFreePreview, setIsFreePreview] = useState(lesson?.isFreePreview ?? false)
  const [videoInvalid, setVideoInvalid] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // A lesson stores the video id, never a link, so a pasted link is reduced to its id here.
    const videoId = provider === 'bunny' ? parseBunnyId(video) : parseYouTubeId(video)
    setVideoInvalid(videoId === null)
    if (videoId === null) return

    const body = {
      title: localizedPayload(title),
      videoProvider: provider,
      videoId,
      durationSeconds:
        Math.max(0, Math.trunc(Number(minutes) || 0)) * 60 +
        Math.max(0, Math.trunc(Number(seconds) || 0)),
      isFreePreview,
    }
    const result = await run(() =>
      lesson
        ? sendJson('PATCH', `/api/lessons/${lesson.id}?locale=all&depth=0`, body)
        : sendJson('POST', '/api/lessons?locale=all&depth=0', {
            ...body,
            module: moduleId,
            position: nextPosition,
          }),
    )
    if (result.ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {lesson ? t('curriculum.editLesson') : t('curriculum.newLesson')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormError code={errorCode} />
          <LocalizedField
            id="lesson-title"
            label={t('curriculum.lessonTitle')}
            value={title}
            onChange={setTitle}
          />

          {providers.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="lesson-provider">{t('curriculum.provider')}</Label>
              <select
                id="lesson-provider"
                className={selectClass}
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value as Provider)
                  setVideoInvalid(false)
                }}
              >
                {providers.map((option) => (
                  <option key={option} value={option}>
                    {t(`curriculum.providers.${option}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t('curriculum.providerHelp')}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-video">{t('curriculum.video')}</Label>
            <Input
              id="lesson-video"
              value={video}
              onChange={(event) => setVideo(event.target.value)}
              required
              dir="ltr"
              aria-invalid={videoInvalid}
              aria-describedby="lesson-video-help"
            />
            <p
              id="lesson-video-help"
              className={
                videoInvalid ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
              }
            >
              {videoInvalid
                ? provider === 'bunny'
                  ? t('curriculum.bunnyInvalid')
                  : t('curriculum.videoInvalid')
                : provider === 'bunny'
                  ? t('curriculum.bunnyHelp')
                  : t('curriculum.videoHelp')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lesson-minutes">{t('curriculum.minutes')}</Label>
              <Input
                id="lesson-minutes"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lesson-seconds">{t('curriculum.seconds')}</Label>
              <Input
                id="lesson-seconds"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                step={1}
                value={seconds}
                onChange={(event) => setSeconds(event.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={isFreePreview}
              onChange={(event) => setIsFreePreview(event.target.checked)}
            />
            <span>
              <span className="font-medium">{t('curriculum.freePreview')}</span>
              <span className="block text-muted-foreground">{t('curriculum.freePreviewHelp')}</span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
