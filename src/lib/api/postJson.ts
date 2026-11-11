import type { ErrorCode } from '@/lib/errors/codes'
import { readErrorCode } from '@/lib/errors/readErrorCode'

export type ApiResult = { ok: true; data: unknown } | { ok: false; code: ErrorCode }

type Method = 'POST' | 'PATCH' | 'DELETE'

async function toResult(request: Promise<Response>): Promise<ApiResult> {
  try {
    const response = await request
    if (!response.ok) return { ok: false, code: await readErrorCode(response) }
    return { ok: true, data: await response.json().catch(() => null) }
  } catch {
    // The request never reached the server (offline, DNS, and so on).
    return { ok: false, code: 'INTERNAL_ERROR' }
  }
}

/**
 * Browser side: send JSON to our API and reduce the answer to "worked" or an error code.
 * Every form uses this, so each one handles failure the same way.
 */
export function sendJson(
  method: Method,
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResult> {
  return toResult(
    fetch(path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

export function postJson(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  return sendJson('POST', path, body)
}

/** Uploads a course thumbnail. Payload expects the file plus its other fields as `_payload`. */
export function uploadImage(file: File, alt: string): Promise<ApiResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('_payload', JSON.stringify({ alt }))
  return toResult(fetch('/api/media', { method: 'POST', credentials: 'include', body: form }))
}

/** Sends a payment screenshot. `expectedAmount` is what the student saw, so a price change is caught. */
export function uploadReceipt(
  orderId: string,
  file: File,
  senderNumber: string,
  expectedAmount: number,
): Promise<ApiResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('_payload', JSON.stringify({ senderNumber, expectedAmount }))
  return toResult(
    fetch(`/api/orders/${orderId}/receipt`, { method: 'POST', credentials: 'include', body: form }),
  )
}

/** The reference of the order an order endpoint answered with, or null. */
export function orderReference(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('reference' in data)) return null
  return typeof data.reference === 'string' ? data.reference : null
}

/** The id of the document an API call created or updated, or null if the answer has none. */
export function documentId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('doc' in data)) return null
  const { doc } = data
  if (typeof doc !== 'object' || doc === null || !('id' in doc)) return null
  return typeof doc.id === 'string' ? doc.id : null
}
