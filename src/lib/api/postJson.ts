import type { ErrorCode } from '@/lib/errors/codes'
import { readErrorCode } from '@/lib/errors/readErrorCode'

export type ApiResult = { ok: true } | { ok: false; code: ErrorCode }

/**
 * Browser side: POST JSON to our API and reduce the answer to "worked" or an error code.
 * Forms use this so each one handles failure the same way.
 */
export async function postJson(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (response.ok) return { ok: true }
    return { ok: false, code: await readErrorCode(response) }
  } catch {
    // The request never reached the server (offline, DNS, and so on).
    return { ok: false, code: 'INTERNAL_ERROR' }
  }
}
