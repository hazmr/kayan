import createMiddleware from 'next-intl/middleware'

import { routing } from './i18n/routing'

// Next.js 16 calls this file "proxy" (it was "middleware" before).
// It adds the locale to URLs that lack one, for example / -> /ar.
export default createMiddleware(routing)

export const config = {
  // Skip the API, Next.js internals, and files such as favicon.ico.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
}
