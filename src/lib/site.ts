import type { Locale } from '@/i18n/locales'
import { env } from '@/lib/env'

/** The academy's name as people see it, in their language (set in .env: SITE_NAME_AR, SITE_NAME_EN). */
export function siteName(locale: Locale | string): string {
  return locale === 'en' ? env.siteName.en : env.siteName.ar
}

/** The academy's doctor as people see them, for example "Dr. Hassan Helal" (INSTRUCTOR_NAME_AR/EN). */
export function instructorName(locale: Locale | string): string {
  return locale === 'en' ? env.instructorName.en : env.instructorName.ar
}

/** The line under the doctor's name on the home page, if the academy set one. */
export function instructorTitle(locale: Locale | string): string | undefined {
  return locale === 'en' ? env.instructorTitle.en : env.instructorTitle.ar
}

/** The doctor's photo (a path under /public), if the academy set one. */
export function instructorPhoto(): string | undefined {
  const path = env.instructorPhoto
  // Only a local file under /public: never an outside address.
  return path && path.startsWith('/') && !path.startsWith('//') ? path : undefined
}
