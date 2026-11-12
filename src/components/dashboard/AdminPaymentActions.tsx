'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
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

function useMoney() {
  const format = useFormatter()
  return (piasters: number) =>
    format.number(piasters / 100, {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
}

/** Today as YYYY-MM-DD in the browser's own time zone, for the date field. */
function today(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** "Record a payment": the academy paid the Admin. The Admin or any instructor may record it. */
export function RecordPaymentButton({
  balance,
}: {
  /** What is owed to the Admin now, in piasters. */
  balance: number
}) {
  const t = useTranslations('dashboard.earnings')
  const tCommon = useTranslations('dashboard.common')
  const money = useMoney()
  const { run, pending, errorCode, clearError } = useApiAction()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [note, setNote] = useState('')

  // Whole piasters from the pounds typed, so no rounding error is ever stored.
  const piasters = Math.round(Number(amount) * 100)
  const valid = Number.isFinite(piasters) && piasters >= 1
  const balanceAfter = balance - (valid ? piasters : 0)
  const overBalance = valid && piasters > balance

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid) return
    const result = await run(() =>
      sendJson('POST', '/api/admin-payments/record', { amount: piasters, paidAt: paidOn, note }),
    )
    if (result.ok) {
      setOpen(false)
      setAmount('')
      setNote('')
      setPaidOn(today())
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          clearError()
          setOpen(true)
        }}
      >
        {t('recordPayment')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('recordTitle')}</DialogTitle>
            <DialogDescription>{t('recordHelp')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FormError code={errorCode} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-amount">{t('amountLabel')}</Label>
              <Input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-describedby="payment-amount-help"
                dir="ltr"
              />
              <p id="payment-amount-help" className="text-xs text-muted-foreground">
                {t('amountHelp')}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-date">{t('dateLabel')}</Label>
              <Input
                id="payment-date"
                type="date"
                required
                max={today()}
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
                dir="ltr"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-note">{t('noteLabel')}</Label>
              <Textarea
                id="payment-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                aria-describedby="payment-note-help"
              />
              <p id="payment-note-help" className="text-xs text-muted-foreground">
                {t('noteHelp')}
              </p>
            </div>

            <dl className="grid gap-1 rounded-lg bg-muted p-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('currentBalance')}</dt>
                <dd className="font-medium">{money(balance)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('balanceAfter')}</dt>
                <dd className={balanceAfter < 0 ? 'font-bold text-destructive' : 'font-bold'}>
                  {money(balanceAfter)}
                </dd>
              </div>
            </dl>
            {overBalance && (
              <Alert variant="destructive">
                <AlertDescription>{t('overBalance')}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={pending || !valid}>
                {t('recordConfirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Removes a payment record. Admin only, with their password; everyone is emailed. */
export function DeletePaymentButton({
  paymentId,
  amount,
  paidAt,
}: {
  paymentId: string
  /** Piasters. */
  amount: number
  paidAt: string
}) {
  const t = useTranslations('dashboard.earnings')
  const tCommon = useTranslations('dashboard.common')
  const money = useMoney()
  const format = useFormatter()
  const { run, pending, errorCode, clearError } = useApiAction()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() =>
      sendJson('POST', `/api/admin-payments/${paymentId}/delete`, { password }),
    )
    if (result.ok) {
      setOpen(false)
      setPassword('')
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => {
          clearError()
          setOpen(true)
        }}
      >
        {t('deletePayment')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteBody', {
                amount: money(amount),
                date: format.dateTime(new Date(paidAt), { dateStyle: 'medium' }),
              })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FormError code={errorCode} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-delete-password">{t('passwordLabel')}</Label>
              <Input
                id="payment-delete-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="payment-delete-password-help"
                dir="ltr"
              />
              <p id="payment-delete-password-help" className="text-xs text-muted-foreground">
                {t('passwordHelp')}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" variant="destructive" disabled={pending || password === ''}>
                {t('deleteConfirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
