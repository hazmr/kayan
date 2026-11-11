'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendJson } from '@/lib/api/postJson'
import { useApiAction } from '@/lib/api/useApiAction'

interface PaymentSettingsFormProps {
  instapayAddress: string
  vodafoneCashNumber: string
}

export function PaymentSettingsForm(initial: PaymentSettingsFormProps) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode } = useApiAction()
  const [instapay, setInstapay] = useState(initial.instapayAddress)
  const [vodafone, setVodafone] = useState(initial.vodafoneCashNumber)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    const result = await run(() =>
      sendJson('POST', '/api/globals/payment-settings', {
        instapayAddress: instapay.trim(),
        vodafoneCashNumber: vodafone.trim(),
      }),
    )
    if (result.ok) setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <FormError code={errorCode} />
      {saved && (
        <Alert role="status">
          <AlertDescription>{t('common.saved')}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="instapay-address">{t('settings.instapayLabel')}</Label>
        <Input
          id="instapay-address"
          value={instapay}
          onChange={(event) => setInstapay(event.target.value)}
          maxLength={120}
          dir="ltr"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="vodafone-number">{t('settings.vodafoneLabel')}</Label>
        <Input
          id="vodafone-number"
          value={vodafone}
          onChange={(event) => setVodafone(event.target.value)}
          maxLength={40}
          dir="ltr"
          aria-describedby="payment-hint"
        />
        <p id="payment-hint" className="text-xs text-muted-foreground">
          {t('settings.paymentHint')}
        </p>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {t('common.save')}
      </Button>
    </form>
  )
}
