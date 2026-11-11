'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { postJson } from '@/lib/api/postJson'
import type { ErrorCode } from '@/lib/errors/codes'

/**
 * The second step of making someone an owner. A button, not an automatic action on page load,
 * because email scanners open links on their own and must not be able to confirm anything.
 */
export function ConfirmOwnerButton({ token, name }: { token: string; name: string }) {
  const t = useTranslations('dashboard')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)

  async function confirm() {
    setState('busy')
    const result = await postJson('/api/users/confirm-owner', { token })
    if (result.ok) {
      setState('done')
      return
    }
    setErrorCode(result.code)
    setState('idle')
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <Alert role="status">
          <AlertDescription>{t('users.confirmDone', { name })}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="self-start">
          <Link href="/dashboard/users">{t('users.backToUsers')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError code={errorCode} />
      <div className="flex gap-2">
        <Button type="button" disabled={state === 'busy'} onClick={confirm}>
          {t('users.confirmButton')}
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/users">{t('common.cancel')}</Link>
        </Button>
      </div>
    </div>
  )
}
