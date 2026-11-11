'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from '@/i18n/navigation'
import { postJson } from '@/lib/api/postJson'
import { MIN_PASSWORD_LENGTH, type ErrorCode } from '@/lib/errors/codes'

import { FormError } from './FormError'

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorCode(null)

    const result = await postJson('/api/users/reset-password', {
      token,
      password: form.get('password'),
    })

    if (!result.ok) {
      setErrorCode(result.code)
      setPending(false)
      return
    }
    // A successful reset also logs the user in.
    router.replace('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError code={errorCode} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('fields.newPassword')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby="password-hint"
          dir="ltr"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          {t('passwordHint', { min: MIN_PASSWORD_LENGTH })}
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {t('reset.submit')}
      </Button>
    </form>
  )
}
