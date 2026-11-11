'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from '@/i18n/navigation'
import { sendJson } from '@/lib/api/postJson'
import type { ErrorCode } from '@/lib/errors/codes'

interface ProfileFormProps {
  userId: string
  email: string
  name: string
  phone: string
}

export function ProfileForm({ userId, email, name, phone }: ProfileFormProps) {
  const t = useTranslations('account')
  const tFields = useTranslations('auth.fields')
  const router = useRouter()
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorCode(null)
    setSaved(false)

    // Only name and phone are sent. The server refuses a role or email change anyway.
    const result = await sendJson('PATCH', `/api/users/${userId}`, {
      name: form.get('name'),
      phone: String(form.get('phone') ?? '').trim() || null,
    })

    setPending(false)
    if (!result.ok) {
      setErrorCode(result.code)
      return
    }
    setSaved(true)
    router.refresh() // the header shows the name
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError code={errorCode} />
      {saved && (
        <Alert role="status">
          <AlertDescription>{t('saved')}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{tFields('email')}</Label>
        <Input id="email" value={email} disabled dir="ltr" aria-describedby="email-note" />
        <p id="email-note" className="text-xs text-muted-foreground">
          {t('emailNote')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{tFields('name')}</Label>
        <Input
          id="name"
          name="name"
          defaultValue={name}
          autoComplete="name"
          required
          maxLength={120}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone}
          autoComplete="tel"
          maxLength={30}
          dir="ltr"
        />
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {t('save')}
      </Button>
    </form>
  )
}
