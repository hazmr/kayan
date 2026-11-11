'use client'

import { ImagePlus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { useRouter } from '@/i18n/navigation'
import { documentId, sendJson, uploadImage } from '@/lib/api/postJson'
import type { CategoryOption, CourseEdit, Localized, PersonOption } from '@/lib/dashboard/types'
import { egpToPiasters } from '@/lib/money'

import { LocalizedField, useApiAction } from './shared'
import { localizedPayload, pick, selectClass } from '@/lib/dashboard/localized'

interface CourseFormProps {
  /** Present when editing. Absent when creating a new course. */
  course?: CourseEdit
  categories: CategoryOption[]
  /** Doctor accounts to choose from. Empty for doctors, who always own what they create. */
  doctors: PersonOption[]
  /** Staff must say which doctor a new course belongs to. */
  mustPickDoctor: boolean
}

const EMPTY: Localized = { ar: '', en: '' }

function uploadedImage(data: unknown): { id: string; url: string } | null {
  if (typeof data !== 'object' || data === null || !('doc' in data)) return null
  const doc = data.doc as { id?: unknown; url?: unknown; sizes?: { card?: { url?: unknown } } }
  const url = doc.sizes?.card?.url ?? doc.url
  return typeof doc.id === 'string' && typeof url === 'string' ? { id: doc.id, url } : null
}

export function CourseForm({ course, categories, doctors, mustPickDoctor }: CourseFormProps) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const router = useRouter()
  const { run, pending, errorCode } = useApiAction()
  const fileInput = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState<Localized>(course?.title ?? EMPTY)
  const [description, setDescription] = useState<Localized>(course?.description ?? EMPTY)
  // A course is filed under one category. The form splits it into "main" and "sub" so people
  // pick a main category first; the subcategory, when chosen, is what gets saved.
  const savedCategory = categories.find((category) => category.id === course?.categoryId)
  const [mainId, setMainId] = useState(savedCategory?.parentId ?? savedCategory?.id ?? '')
  const [subId, setSubId] = useState(savedCategory?.parentId ? savedCategory.id : '')
  const categoryId = subId !== '' ? subId : mainId
  const [price, setPrice] = useState(String(course?.priceEgp ?? 0))
  const [thumbnail, setThumbnail] = useState(course?.thumbnail ?? null)
  const [ownerId, setOwnerId] = useState(course?.owner.id ?? '')
  const [share, setShare] = useState(
    course?.ownerSharePercent === null || course?.ownerSharePercent === undefined
      ? ''
      : String(course.ownerSharePercent),
  )
  const [saved, setSaved] = useState(false)
  const [confirmOwner, setConfirmOwner] = useState(false)

  const canEditPrice = course ? course.can.editPrice : true
  const canEditOwnerAndShare = course ? course.can.editOwnerAndShare : false
  const mainCategories = categories.filter((category) => category.parentId === null)
  const subcategories = categories.filter(
    (category) => mainId !== '' && category.parentId === mainId,
  )

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const result = await run(() => uploadImage(file, title.ar || file.name))
    if (result.ok) setThumbnail(uploadedImage(result.data))
  }

  const ownerChanged = Boolean(course && canEditOwnerAndShare && ownerId !== course.owner.id)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Moving a course to another doctor changes who earns from it, so it is confirmed first.
    if (ownerChanged) {
      setConfirmOwner(true)
      return
    }
    void save()
  }

  async function save() {
    setConfirmOwner(false)
    setSaved(false)

    const body: Record<string, unknown> = {
      title: localizedPayload(title),
      description: localizedPayload(description),
      category: categoryId === '' ? null : categoryId,
      thumbnail: thumbnail?.id ?? null,
    }
    // Only send what this person may change. The server ignores or refuses the rest anyway.
    if (canEditPrice) body.price = egpToPiasters(Math.max(0, Math.trunc(Number(price) || 0)))
    if (!course && mustPickDoctor) body.owner = ownerId
    if (course && canEditOwnerAndShare) {
      body.owner = ownerId
      if (share !== '') body.ownerSharePercent = Math.trunc(Number(share))
    }

    if (!course) {
      const result = await run(() => sendJson('POST', '/api/courses?locale=all&depth=0', body))
      const id = result.ok ? documentId(result.data) : null
      // Straight to the course page, where modules and lessons are added.
      if (id) router.push(`/dashboard/courses/${id}`)
      return
    }

    const result = await run(() =>
      sendJson('PATCH', `/api/courses/${course.id}?locale=all&depth=0`, body),
    )
    if (result.ok) setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormError code={errorCode} />
      {saved && (
        <Alert role="status">
          <AlertDescription>{t('common.saved')}</AlertDescription>
        </Alert>
      )}

      {/* Staff decide whose course this is before anything else. */}
      {((!course && mustPickDoctor) || (course && canEditOwnerAndShare)) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="course-owner">{t('course.doctor')}</Label>
            <select
              id="course-owner"
              className={selectClass}
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              required
            >
              <option value="">{t('course.chooseDoctor')}</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name} ({doctor.email})
                </option>
              ))}
            </select>
          </div>

          {course && canEditOwnerAndShare && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="course-share">{t('course.share')}</Label>
              <Input
                id="course-share"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={share}
                onChange={(event) => setShare(event.target.value)}
                aria-describedby="course-share-help"
                dir="ltr"
              />
              <p id="course-share-help" className="text-xs text-muted-foreground">
                {t('course.shareHelp')}
              </p>
            </div>
          )}
        </div>
      )}

      <LocalizedField
        id="course-title"
        label={t('course.titleLabel')}
        value={title}
        onChange={setTitle}
      />
      <LocalizedField
        id="course-description"
        label={t('course.descriptionLabel')}
        value={description}
        onChange={setDescription}
        multiline
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="course-category">{t('course.mainCategory')}</Label>
            <select
              id="course-category"
              className={selectClass}
              value={mainId}
              onChange={(event) => {
                setMainId(event.target.value)
                setSubId('') // a subcategory belongs to one main category, so choose again
              }}
            >
              <option value="">{t('course.noCategory')}</option>
              {mainCategories.map((main) => (
                <option key={main.id} value={main.id}>
                  {pick(main.title, locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="course-subcategory">{t('course.subcategory')}</Label>
            <select
              id="course-subcategory"
              className={selectClass}
              value={subId}
              onChange={(event) => setSubId(event.target.value)}
              disabled={subcategories.length === 0}
              aria-describedby="course-subcategory-help"
            >
              <option value="">{t('course.noSubcategory')}</option>
              {subcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {pick(subcategory.title, locale)}
                </option>
              ))}
            </select>
            <p id="course-subcategory-help" className="text-xs text-muted-foreground">
              {mainId === ''
                ? t('course.subcategoryPickMain')
                : subcategories.length === 0
                  ? t('course.subcategoryNone')
                  : t('course.subcategoryHelp')}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="course-price">{t('course.price')}</Label>
          <Input
            id="course-price"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            disabled={!canEditPrice}
            aria-describedby="course-price-help"
            dir="ltr"
          />
          <p id="course-price-help" className="text-xs text-muted-foreground">
            {canEditPrice ? t('course.priceHelp') : t('course.priceLocked')}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('course.thumbnail')}</span>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleImage}
          aria-label={t('course.thumbnail')}
        />
        {thumbnail ? (
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative aspect-video w-56 overflow-hidden rounded-lg border">
              <Image src={thumbnail.url} alt="" fill sizes="224px" className="object-cover" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => fileInput.current?.click()}
            >
              {t('course.changeImage')}
            </Button>
          </div>
        ) : (
          // No image yet: one clear place to add one, instead of an empty box.
          <button
            type="button"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
            className="flex aspect-video w-56 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          >
            <ImagePlus className="size-6" aria-hidden />
            <span className="font-medium">{t('course.chooseImage')}</span>
          </button>
        )}
        <p className="text-xs text-muted-foreground">{t('course.thumbnailHelp')}</p>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {course ? t('common.save') : t('course.createAndContinue')}
      </Button>

      <Dialog open={confirmOwner} onOpenChange={setConfirmOwner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('course.ownerChangeTitle')}</DialogTitle>
            <DialogDescription>
              {t('course.ownerChangeBody', {
                from: course?.owner.name ?? '',
                to: doctors.find((doctor) => doctor.id === ownerId)?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOwner(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void save()}>
              {t('course.ownerChangeConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
