'use client'

import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendJson } from '@/lib/api/postJson'
import { useApiAction } from '@/lib/api/useApiAction'
import { pick } from '@/lib/dashboard/localized'
import type { QueueItem } from '@/lib/dashboard/paymentQueries'
import type { Locale } from '@/i18n/locales'

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function useMoney() {
  const format = useFormatter()
  const t = useTranslations('orders')
  return (egp: number) =>
    egp === 0
      ? t('free')
      : format.number(egp, { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })
}

/** A dialog that asks for a note before an action the student will read (reject, decline). */
function NoteDialog({
  open,
  onClose,
  title,
  help,
  label,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  help: string
  label: string
  confirmLabel: string
  onConfirm: (note: string) => Promise<{ ok: boolean }>
}) {
  const t = useTranslations('dashboard.common')
  const { run, pending, errorCode, clearError } = useApiAction()
  const [note, setNote] = useState('')

  async function confirm() {
    const result = await run(() => onConfirm(note) as ReturnType<typeof sendJson>)
    if (result.ok) {
      setNote('')
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          clearError()
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{help}</DialogDescription>
        </DialogHeader>
        <FormError code={errorCode} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="queue-note">{label}</Label>
          <Textarea
            id="queue-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || note.trim() === ''}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => ReturnType<typeof sendJson>
}) {
  const t = useTranslations('dashboard.common')
  const { run, pending, errorCode, clearError } = useApiAction()

  async function confirm() {
    const result = await run(onConfirm)
    if (result.ok) onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          clearError()
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <FormError code={errorCode} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" disabled={pending} onClick={confirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A receipt waiting for review: the screenshot next to everything needed to check it. */
export function PaymentReviewCard({ item }: { item: QueueItem }) {
  const t = useTranslations('dashboard.payments')
  const tMethods = useTranslations('orders.methodNames')
  const locale = useLocale() as Locale
  const format = useFormatter()
  const money = useMoney()
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)

  const current = [...item.receipts].reverse().find((receipt) => receipt.decision === null)
  const earlier = item.receipts.filter((receipt) => receipt !== current)

  return (
    <article className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[220px_1fr] md:p-6">
      {current ? (
        <a href={current.url} target="_blank" rel="noreferrer" title={t('openFull')}>
          {/* A plain image: receipts are private and must not be cached or proxied by the optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt=""
            className="max-h-72 w-full rounded-lg border bg-muted object-contain"
          />
        </a>
      ) : (
        <div className="rounded-lg border bg-muted" />
      )}

      <div className="flex min-w-0 flex-col gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label={t('student')}>
            {item.student.name}
            <span className="block text-xs font-normal text-muted-foreground" dir="ltr">
              {item.student.email}
            </span>
          </Detail>
          <Detail label={t('course')}>{pick(item.courseTitle, locale)}</Detail>
          <Detail label={t('amount')}>
            <span className="text-lg text-primary">{money(item.amountEgp)}</span>
          </Detail>
          <Detail label={t('method')}>{item.method ? tMethods(item.method) : '-'}</Detail>
          <Detail label={t('sentFrom')}>
            <span dir="ltr">{current?.senderNumber ?? '-'}</span>
          </Detail>
          <Detail label={t('reference')}>
            <span dir="ltr">{item.reference}</span>
          </Detail>
          <Detail label={t('submitted')}>
            {format.dateTime(new Date(current?.createdAt ?? item.createdAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Detail>
        </dl>

        {earlier.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">{t('earlier')}</span>
            <ul className="flex flex-wrap gap-3">
              {earlier.map((receipt) => (
                <li key={receipt.id} className="flex items-center gap-2 text-xs">
                  <a href={receipt.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={receipt.url} alt="" className="size-12 rounded border object-cover" />
                  </a>
                  <span className="flex flex-col">
                    <Badge variant={receipt.decision === 'rejected' ? 'destructive' : 'secondary'}>
                      {receipt.decision === 'approved' ? t('approvedBefore') : t('rejectedBefore')}
                    </Badge>
                    {receipt.reviewNote !== '' && (
                      <span className="text-muted-foreground">{receipt.reviewNote}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setDialog('approve')}>
            {t('approve')}
          </Button>
          <Button type="button" variant="outline" onClick={() => setDialog('reject')}>
            {t('reject')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        title={t('approveTitle')}
        body={t('approveBody', { student: item.student.name })}
        confirmLabel={t('approveConfirm')}
        onConfirm={() => sendJson('POST', `/api/orders/${item.id}/approve`)}
      />
      <NoteDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title={t('rejectTitle')}
        help={t('rejectHelp')}
        label={t('rejectNote')}
        confirmLabel={t('rejectConfirm')}
        onConfirm={(note) => sendJson('POST', `/api/orders/${item.id}/reject`, { note })}
      />
    </article>
  )
}

/** A refund request: who asked, why, and where to send the money. */
export function RefundRequestCard({ item }: { item: QueueItem }) {
  const t = useTranslations('dashboard.refunds')
  const tPay = useTranslations('dashboard.payments')
  const locale = useLocale() as Locale
  const format = useFormatter()
  const money = useMoney()
  const [dialog, setDialog] = useState<'decline' | 'refund' | null>(null)
  const refund = item.refund

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label={tPay('student')}>
          {item.student.name}
          <span className="block text-xs font-normal text-muted-foreground" dir="ltr">
            {item.student.email}
          </span>
        </Detail>
        <Detail label={tPay('course')}>{pick(item.courseTitle, locale)}</Detail>
        <Detail label={tPay('amount')}>
          <span className="text-lg text-primary">{money(item.amountEgp)}</span>
        </Detail>
        <Detail label={tPay('reference')}>
          <span dir="ltr">{item.reference}</span>
        </Detail>
        <Detail label={t('sendTo')}>
          <span dir="ltr">{refund?.refundTo}</span>
        </Detail>
        <Detail label={t('requested')}>
          {refund &&
            format.dateTime(new Date(refund.requestedAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
        </Detail>
        <div className="sm:col-span-2">
          <Detail label={t('reason')}>
            <span className="font-normal whitespace-pre-line">{refund?.reason}</span>
          </Detail>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setDialog('refund')}>
          {t('markRefunded')}
        </Button>
        <Button type="button" variant="outline" onClick={() => setDialog('decline')}>
          {t('decline')}
        </Button>
      </div>

      <ConfirmDialog
        open={dialog === 'refund'}
        onClose={() => setDialog(null)}
        title={t('markTitle')}
        body={t('markBody', { amount: money(item.amountEgp), student: item.student.name })}
        confirmLabel={t('markConfirm')}
        onConfirm={() => sendJson('POST', `/api/orders/${item.id}/refund`)}
      />
      <NoteDialog
        open={dialog === 'decline'}
        onClose={() => setDialog(null)}
        title={t('declineTitle')}
        help={t('declineHelp')}
        label={t('declineNote')}
        confirmLabel={t('declineConfirm')}
        onConfirm={(note) =>
          sendJson('POST', `/api/orders/${item.id}/refund-request/decline`, { note })
        }
      />
    </article>
  )
}
