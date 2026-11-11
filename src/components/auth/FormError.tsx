'use client'

import { useTranslations } from 'next-intl'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ErrorCode } from '@/lib/errors/codes'

/** Shows the translated text for an API error code. Renders nothing when there is no error. */
export function FormError({ code }: { code: ErrorCode | null }) {
  const t = useTranslations('errors')
  if (!code) return null

  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{t(code)}</AlertDescription>
    </Alert>
  )
}
