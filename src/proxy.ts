import createMiddleware from 'next-intl/middleware'

import { routing } from './i18n/routing'

// Next.js 16 calls this file "proxy" (it was "middleware" before).
// It redirects URLs without a locale, for example / -> /ar.
export default createMiddleware(routing)

export const config = {
  // Skip Payload (/api, /admin), Next.js internals, and files such as favicon.ico.
  matcher: '/((?!api|admin|_next|_vercel|.*\\..*).*)',
}
