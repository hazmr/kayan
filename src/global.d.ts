import type { routing } from '@/i18n/routing'

import type messages from '../messages/ar.json'

// Tells next-intl the shape of our messages, so a typo in a translation key
// (or an error code with no translation) is a compile error instead of a blank on the page.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number]
    Messages: typeof messages
  }
}
