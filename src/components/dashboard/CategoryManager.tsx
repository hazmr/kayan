'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { sendJson } from '@/lib/api/postJson'
import type { CategoryOption, Localized } from '@/lib/dashboard/types'

import { ConfirmDelete, LocalizedField, useApiAction } from './shared'
import { localizedPayload, pick } from '@/lib/dashboard/localized'

type Editing = { category?: CategoryOption; parentId: string | null } | null

export function CategoryManager({ categories }: { categories: CategoryOption[] }) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const [editing, setEditing] = useState<Editing>(null)
  const mains = categories.filter((category) => category.parentId === null)

  function row(category: CategoryOption) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <span>
          {pick(category.title, locale)}
          <span className="ms-2 text-xs text-muted-foreground" dir="ltr">
            {category.slug}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing({ category, parentId: category.parentId })}
          >
            {t('common.edit')}
          </Button>
          <ConfirmDelete
            label={t('common.delete')}
            onConfirm={() => sendJson('DELETE', `/api/categories/${category.id}`)}
          />
        </span>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('categories.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('categories.help')}</p>
        </div>
        <Button type="button" onClick={() => setEditing({ parentId: null })}>
          {t('categories.addMain')}
        </Button>
      </div>

      {mains.length === 0 && (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          {t('categories.empty')}
        </p>
      )}

      {mains.map((main) => (
        <div key={main.id} className="overflow-hidden rounded-xl border bg-card">
          <div className="bg-muted font-semibold">{row(main)}</div>
          <div className="divide-y ps-6">
            {categories
              .filter((sub) => sub.parentId === main.id)
              .map((sub) => (
                <div key={sub.id}>{row(sub)}</div>
              ))}
          </div>
          <div className="border-t px-4 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing({ parentId: main.id })}
            >
              {t('categories.addSub')}
            </Button>
          </div>
        </div>
      ))}

      {editing && <CategoryDialog editing={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function CategoryDialog({
  editing,
  onClose,
}: {
  editing: NonNullable<Editing>
  onClose: () => void
}) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode } = useApiAction()
  const [title, setTitle] = useState<Localized>(editing.category?.title ?? { ar: '', en: '' })
  const existing = editing.category

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() =>
      existing
        ? sendJson('PATCH', `/api/categories/${existing.id}?locale=all&depth=0`, {
            title: localizedPayload(title),
          })
        : sendJson('POST', '/api/categories?locale=all&depth=0', {
            title: localizedPayload(title),
            ...(editing.parentId ? { parent: editing.parentId } : {}),
          }),
    )
    if (result.ok) onClose()
  }

  const heading = existing
    ? t('categories.editTitle')
    : editing.parentId
      ? t('categories.newSub')
      : t('categories.newMain')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormError code={errorCode} />
          <LocalizedField
            id="category-title"
            label={t('categories.name')}
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
