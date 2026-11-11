'use client'

import { useState } from 'react'

import { useRouter } from '@/i18n/navigation'
import type { ApiResult } from '@/lib/api/postJson'
import type { ErrorCode } from '@/lib/errors/codes'

/**
 * Runs one API call and tracks "busy" and "what went wrong" for the component using it.
 * On success it refreshes the page data, so the screen always shows what the server has.
 */
export function useApiAction() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)

  async function run(request: () => Promise<ApiResult>): Promise<ApiResult> {
    setPending(true)
    setErrorCode(null)
    const result = await request()
    setPending(false)
    if (result.ok) router.refresh()
    else setErrorCode(result.code)
    return result
  }

  return { run, pending, errorCode, clearError: () => setErrorCode(null) }
}
