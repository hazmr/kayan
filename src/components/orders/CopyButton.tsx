'use client'

import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

/** Copies a value (an account number, an order reference) so nobody has to retype it. */
export function CopyButton({ value }: { value: string }) {
  const t = useTranslations('orders')
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be blocked (insecure page, denied permission). The value is
      // still on screen to copy by hand, so there is nothing to report.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? t('copied') : t('copy')}
    </Button>
  )
}
