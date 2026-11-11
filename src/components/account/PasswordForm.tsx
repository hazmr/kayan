'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { postJson } from '@/lib/api/postJson'
import { MIN_PASSWORD_LENGTH, type ErrorCode } from '@/lib/errors/codes'

export function PasswordForm() {
  const t = useTranslations('account')
  const tAuth = useTranslations('auth')
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)
  const [pending, setPending] = useState(false)
  const [changed, setChanged] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setPending(true)
    setErrorCode(null)
    setChanged(false)

    const result = await postJson('/api/users/change-password', {
      currentPassword: form.get('currentPassword'),
      newPassword: form.get('newPassword'),
    })

    setPending(false)
    if (!result.ok) {
      setErrorCode(result.code)
      return
    }
    setChanged(true)
    formElement.reset()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError code={errorCode} />
      {changed && (
        <Alert role="status">
          <AlertDescription>{t('passwordChanged')}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">{tAuth('fields.newPassword')}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby="new-password-hint"
          dir="ltr"
        />
        <p id="new-password-hint" className="text-xs text-muted-foreground">
          {tAuth('passwordHint', { min: MIN_PASSWORD_LENGTH })}
        </p>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {t('save')}
      </Button>
    </form>
  )
}
