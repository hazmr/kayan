'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link } from '@/i18n/navigation'
import { postJson } from '@/lib/api/postJson'
import type { ErrorCode } from '@/lib/errors/codes'

import { FormError } from './FormError'

export function ForgotPasswordForm() {
  const t = useTranslations('auth')
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorCode(null)

    const result = await postJson('/api/users/forgot-password', { email: form.get('email') })

    setPending(false)
    if (!result.ok) {
      setErrorCode(result.code)
      return
    }
    // The server answers the same way whether or not the email exists,
    // so this page cannot be used to find out who has an account.
    setSent(true)
  }

  if (sent) {
    return (
      <Alert>
        <AlertTitle>{t('forgot.sentTitle')}</AlertTitle>
        <AlertDescription>{t('forgot.sentBody')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError code={errorCode} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('fields.email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </div>

      <Button type="submit" disabled={pending}>
        {t('forgot.submit')}
      </Button>

      <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
        {t('forgot.backToLogin')}
      </Link>
    </form>
  )
}
