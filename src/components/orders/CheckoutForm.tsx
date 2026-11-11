'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { orderReference, postJson } from '@/lib/api/postJson'
import { useApiAction } from '@/lib/api/useApiAction'
import type { PaymentMethod } from '@/lib/orders/transitions'

interface CheckoutFormProps {
  courseId: string
  courseTitle: string
  priceEgp: number
  /** Methods with a number or address set up. Empty means payment is not ready yet. */
  methods: PaymentMethod[]
}

export function CheckoutForm({ courseId, courseTitle, priceEgp, methods }: CheckoutFormProps) {
  const t = useTranslations('checkout')
  const tOrders = useTranslations('orders')
  const format = useFormatter()
  const router = useRouter()
  const { run, pending, errorCode } = useApiAction()
  const [method, setMethod] = useState<PaymentMethod | undefined>(methods[0])
  const isFree = priceEgp === 0

  async function start() {
    const result = await run(() => postJson('/api/orders/start', { courseId, method }))
    const reference = result.ok ? orderReference(result.data) : null
    if (reference) router.push(`/orders/${reference}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4 rounded-xl border bg-card p-4">
        <span className="font-semibold">{courseTitle}</span>
        <span className="text-lg font-bold text-primary">
          {isFree
            ? tOrders('free')
            : format.number(priceEgp, {
                style: 'currency',
                currency: 'EGP',
                maximumFractionDigits: 0,
              })}
        </span>
      </div>

      <FormError code={errorCode} />

      {isFree ? (
        <>
          <p className="text-sm text-muted-foreground">{t('freeNote')}</p>
          <Button size="lg" disabled={pending} onClick={start} className="self-start">
            {t('enrollFree')}
          </Button>
        </>
      ) : methods.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          {t('noMethods')}
        </p>
      ) : (
        <>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 font-medium">{t('chooseMethod')}</legend>
            {methods.map((option) => (
              <label
                key={option}
                className={
                  'flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 transition-colors ' +
                  (method === option ? 'border-primary bg-primary/5' : 'hover:bg-muted')
                }
              >
                <input
                  type="radio"
                  name="method"
                  value={option}
                  checked={method === option}
                  onChange={() => setMethod(option)}
                />
                <span className="font-medium">{tOrders(`methodNames.${option}`)}</span>
              </label>
            ))}
          </fieldset>
          <Button size="lg" disabled={pending || !method} onClick={start} className="self-start">
            {t('continue')}
          </Button>
        </>
      )}
    </div>
  )
}
