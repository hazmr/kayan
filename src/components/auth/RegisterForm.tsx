'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link } from '@/i18n/navigation'
import { postJson } from '@/lib/api/postJson'
import { MIN_PASSWORD_LENGTH, type ErrorCode } from '@/lib/errors/codes'

import { FormError } from './FormError'

export function RegisterForm() {
  const t = useTranslations('auth')
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)
  const [pending, setPending] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const phone = String(form.get('phone') ?? '').trim()
    setPending(true)
    setErrorCode(null)

    // No role is sent, and the server would ignore one anyway: registration always creates a student.
    const result = await postJson('/api/users', {
      name: form.get('name'),
      email,
      password: form.get('password'),
      ...(phone ? { phone } : {}),
    })

    setPending(false)
    if (!result.ok) {
      setErrorCode(result.code)
      return
    }
    setRegisteredEmail(email)
  }

  if (registeredEmail) {
    return (
      <Alert>
        <AlertTitle>{t('register.successTitle')}</AlertTitle>
        <AlertDescription>{t('register.successBody', { email: registeredEmail })}</AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError code={errorCode} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t('fields.name')}</Label>
        <Input id="name" name="name" autoComplete="name" required maxLength={120} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('fields.email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('fields.password')}</Label>
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t('fields.phone')}</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} dir="ltr" />
      </div>

      <Button type="submit" disabled={pending}>
        {t('register.submit')}
      </Button>

      <p className="text-sm text-muted-foreground">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          {t('login.title')}
        </Link>
      </p>
    </form>
  )
}
