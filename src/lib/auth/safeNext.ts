/**
 * "Log in, then go back to where you were". The destination comes from the URL, so it must be
 * checked: only a path on this site is accepted, never a full address that could send someone
 * to another website after they log in.
 */
export function safeNext(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const isLocalPath = /^\/[^/\\]/.test(value) && !value.includes('://')
  return isLocalPath ? value : undefined
}
