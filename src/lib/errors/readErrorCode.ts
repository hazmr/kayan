import { isErrorCode, type ErrorCode } from './codes'

/**
 * Browser side: pull the error code out of a failed API response.
 * Anything unexpected becomes INTERNAL_ERROR, so the UI always has a message to show.
 */
export async function readErrorCode(response: Response): Promise<ErrorCode> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'code' in body && isErrorCode(body.code)) {
      return body.code
    }
  } catch {
    // The body was not JSON (for example a proxy error page). Fall through.
  }
  return 'INTERNAL_ERROR'
}
