import { defineRouting } from 'next-intl/routing'

import { DEFAULT_LOCALE, LOCALES } from './locales'

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Every URL carries its locale: /ar/... and /en/...
  localePrefix: 'always',
  // A URL without a locale always goes to Arabic, whatever the browser language is.
  // Why: the same link then opens the same page for everyone. People switch with the header button.
  localeDetection: false,
})
