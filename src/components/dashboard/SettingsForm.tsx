'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendJson } from '@/lib/api/postJson'

import { useApiAction } from './shared'

export function SettingsForm({ defaultOwnerSharePercent }: { defaultOwnerSharePercent: number }) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode } = useApiAction()
  const [share, setShare] = useState(String(defaultOwnerSharePercent))
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    const result = await run(() =>
      sendJson('POST', '/api/globals/platform-settings', {
        defaultOwnerSharePercent: Math.trunc(Number(share)),
      }),
    )
    if (result.ok) setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <FormError code={errorCode} />
      {saved && (
        <Alert role="status">
          <AlertDescription>{t('common.saved')}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="default-share">{t('settings.shareLabel')}</Label>
        <Input
          id="default-share"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          required
          value={share}
          onChange={(event) => setShare(event.target.value)}
          aria-describedby="default-share-help"
          dir="ltr"
        />
        <p id="default-share-help" className="text-xs text-muted-foreground">
          {t('settings.shareHelp')}
        </p>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {t('common.save')}
      </Button>
    </form>
  )
}
