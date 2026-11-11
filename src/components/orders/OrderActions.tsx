'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendJson } from '@/lib/api/postJson'
import { useApiAction } from '@/lib/api/useApiAction'
import type { PaymentMethod } from '@/lib/orders/transitions'

/** "Pay another way": switches between InstaPay and Vodafone Cash before the student has paid. */
export function MethodSwitcher({
  orderId,
  current,
  methods,
}: {
  orderId: string
  current: PaymentMethod | null
  methods: PaymentMethod[]
}) {
  const t = useTranslations('orders')
  const { run, pending, errorCode } = useApiAction()
  const others = methods.filter((method) => method !== current)
  if (others.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <FormError code={errorCode} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {t('payAnotherWay')}:
        {others.map((method) => (
          <Button
            key={method}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              void run(() => sendJson('POST', `/api/orders/${orderId}/method`, { method }))
            }
          >
            {t(`methodNames.${method}`)}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const t = useTranslations('orders')
  const { run, pending, errorCode } = useApiAction()
  const [open, setOpen] = useState(false)

  async function cancel() {
    const result = await run(() => sendJson('POST', `/api/orders/${orderId}/cancel`))
    if (result.ok) setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-destructive"
        onClick={() => setOpen(true)}
      >
        {t('cancelOrder')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelTitle')}</DialogTitle>
            <DialogDescription>{t('cancelBody')}</DialogDescription>
          </DialogHeader>
          <FormError code={errorCode} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('keepOrder')}
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={cancel}>
              {t('cancelOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface RefundSectionProps {
  orderId: string
  status: 'none' | 'requested' | 'declined'
  refund: { reason: string; refundTo: string; decisionNote: string } | null
}

/** Ask for the money back, see where the request stands, or withdraw it. */
export function RefundSection({ orderId, status, refund }: RefundSectionProps) {
  const t = useTranslations('orders')
  const { run, pending, errorCode } = useApiAction()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [refundTo, setRefundTo] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() =>
      sendJson('POST', `/api/orders/${orderId}/refund-request`, { reason, refundTo }),
    )
    if (result.ok) setAsking(false)
  }

  const showForm = status === 'none' || asking

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6">
      <h2 className="text-lg font-bold">{t('refundTitle')}</h2>
      <FormError code={errorCode} />

      {status === 'requested' && refund && (
        <>
          <p className="text-sm">{t('refundRequested')}</p>
          <dl className="grid gap-1 text-sm text-muted-foreground">
            <div>
              <dt className="inline font-medium">{t('refundReason')}: </dt>
              <dd className="inline whitespace-pre-line">{refund.reason}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{t('refundTo')}: </dt>
              <dd className="inline" dir="ltr">
                {refund.refundTo}
              </dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={pending}
            onClick={() =>
              void run(() => sendJson('POST', `/api/orders/${orderId}/refund-request/cancel`))
            }
          >
            {t('refundWithdraw')}
          </Button>
        </>
      )}

      {status === 'declined' && refund && !asking && (
        <>
          <p className="text-sm font-medium text-destructive">{t('refundDeclined')}</p>
          {refund.decisionNote !== '' && (
            <p className="text-sm">
              <span className="font-medium">{t('refundDeclinedNote')}: </span>
              {refund.decisionNote}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setAsking(true)}
          >
            {t('refundAgain')}
          </Button>
        </>
      )}

      {showForm && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('refundHelp')}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="refund-reason">{t('refundReason')}</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="refund-to">{t('refundTo')}</Label>
            <Input
              id="refund-to"
              value={refundTo}
              onChange={(event) => setRefundTo(event.target.value)}
              required
              maxLength={120}
              dir="ltr"
            />
          </div>
          <Button
            type="submit"
            disabled={pending || reason.trim() === '' || refundTo.trim() === ''}
            className="self-start"
          >
            {t('refundSubmit')}
          </Button>
        </form>
      )}
    </section>
  )
}
