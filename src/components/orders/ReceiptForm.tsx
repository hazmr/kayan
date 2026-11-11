'use client'

import { ImagePlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, type FormEvent } from 'react'

import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadReceipt } from '@/lib/api/postJson'
import { useApiAction } from '@/lib/api/useApiAction'
import { useRouter } from '@/i18n/navigation'
import type { ErrorCode } from '@/lib/errors/codes'

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface ReceiptFormProps {
  orderId: string
  /** Piasters the student is looking at. The server refuses the upload if the price moved. */
  amount: number
}

export function ReceiptForm({ orderId, amount }: ReceiptFormProps) {
  const t = useTranslations('orders')
  const router = useRouter()
  const { run, pending, errorCode } = useApiAction()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sender, setSender] = useState('')
  // A problem found in the browser, before any upload (the server checks again).
  const [localError, setLocalError] = useState<ErrorCode | null>(null)

  function choose(selected: File | undefined) {
    setLocalError(null)
    if (!selected) return
    if (!TYPES.includes(selected.type)) return setLocalError('RECEIPT_INVALID_TYPE')
    if (selected.size > MAX_BYTES) return setLocalError('RECEIPT_TOO_LARGE')
    setFile(selected)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    const result = await run(() => uploadReceipt(orderId, file, sender, amount))
    // The price moved while the page was open: reload so the new amount is on screen.
    if (!result.ok && result.code === 'ORDER_PRICE_CHANGED') router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6"
    >
      <h2 className="text-lg font-bold">{t('receiptTitle')}</h2>
      <FormError code={localError ?? errorCode} />

      <div className="flex flex-col gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={TYPES.join(',')}
          className="sr-only"
          aria-label={t('chooseFile')}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
        >
          <ImagePlus className="size-6" aria-hidden />
          <span className="font-medium">{file ? file.name : t('chooseFile')}</span>
          {file && <span className="text-xs">{t('changeFile')}</span>}
        </button>
        <p className="text-xs text-muted-foreground">{t('receiptHelp')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sender-number">{t('senderNumber')}</Label>
        <Input
          id="sender-number"
          value={sender}
          onChange={(event) => setSender(event.target.value)}
          required
          maxLength={40}
          dir="ltr"
          aria-describedby="sender-help"
        />
        <p id="sender-help" className="text-xs text-muted-foreground">
          {t('senderHelp')}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">{t('amountNotice')}</p>
      <Button
        type="submit"
        disabled={pending || !file || sender.trim() === ''}
        className="self-start"
      >
        {t('sendReceipt')}
      </Button>
    </form>
  )
}
