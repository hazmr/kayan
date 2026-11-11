'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link, useRouter } from '@/i18n/navigation'
import { postJson } from '@/lib/api/postJson'
import type { ErrorCode } from '@/lib/errors/codes'

import { FormError } from './FormError'

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorCode(null)

    const result = await postJson('/api/users/login', {
      email: form.get('email'),
      password: form.get('password'),
    })

    if (!result.ok) {
      setErrorCode(result.code)
      setPending(false)
      return
    }
    // Payload set the login cookie. Go back to where the visitor was heading (or home) and
    // re-render the header with the user.
    router.replace(next ?? '/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError code={errorCode} />

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
          autoComplete="current-password"
          required
          dir="ltr"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {t('login.submit')}
      </Button>

      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          {t('login.forgot')}
        </Link>
        <p>
          {t('login.noAccount')}{' '}
          <Link href="/register" className="text-primary underline-offset-4 hover:underline">
            {t('register.title')}
          </Link>
        </p>
      </div>
    </form>
  )
}
