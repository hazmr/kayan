'use client'

import { useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ApiResult } from '@/lib/api/postJson'
import type { CourseStatus } from '@/lib/courses/transitions'
import type { Localized } from '@/lib/dashboard/types'

export { useApiAction } from '@/lib/api/useApiAction'
import { useApiAction } from '@/lib/api/useApiAction'

const STATUS_VARIANT: Record<CourseStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  published: 'default',
  archived: 'destructive',
}

export function StatusBadge({ status }: { status: CourseStatus }) {
  const t = useTranslations('dashboard.status')
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>
}

/** Arabic and English inputs for one field, side by side. Arabic is required, English optional. */
export function LocalizedField({
  id,
  label,
  value,
  onChange,
  multiline = false,
}: {
  id: string
  label: string
  value: Localized
  onChange: (value: Localized) => void
  multiline?: boolean
}) {
  const t = useTranslations('dashboard.common')
  const Field = multiline ? Textarea : Input

  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-ar`} className="text-xs text-muted-foreground">
          {t('arabic')}
        </Label>
        <Field
          id={`${id}-ar`}
          value={value.ar}
          onChange={(event) => onChange({ ...value, ar: event.target.value })}
          required
          dir="rtl"
          lang="ar"
          rows={multiline ? 5 : undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-en`} className="text-xs text-muted-foreground">
          {t('englishOptional')}
        </Label>
        <Field
          id={`${id}-en`}
          value={value.en}
          onChange={(event) => onChange({ ...value, en: event.target.value })}
          dir="ltr"
          lang="en"
          rows={multiline ? 5 : undefined}
        />
      </div>
    </fieldset>
  )
}

/** A delete button that asks first, and shows the reason when the server refuses. */
export function ConfirmDelete({
  onConfirm,
  body,
  label,
  children,
}: {
  onConfirm: () => Promise<ApiResult>
  body?: string
  label: string
  children?: ReactNode
}) {
  const t = useTranslations('dashboard.common')
  const { run, pending, errorCode, clearError } = useApiAction()
  const [open, setOpen] = useState(false)

  async function confirm() {
    const result = await run(onConfirm)
    if (result.ok) setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        aria-label={label}
        onClick={() => {
          clearError()
          setOpen(true)
        }}
      >
        {children ?? t('delete')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmDeleteTitle')}</DialogTitle>
            <DialogDescription>{body ?? t('confirmDeleteBody')}</DialogDescription>
          </DialogHeader>
          <FormError code={errorCode} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
