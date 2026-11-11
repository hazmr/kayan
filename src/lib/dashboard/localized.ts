import type { Locale } from '@/i18n/locales'

import type { Localized } from './types'

// Small helpers for two-language values. No 'use client' here on purpose:
// both server pages and browser components call these.

/** The text to show for a two-language value: the current language, or Arabic when it is empty. */
export function pick(value: Localized, locale: Locale): string {
  return value[locale] !== '' ? value[locale] : value.ar
}

/** What the API expects for a two-language field. An empty English value is stored as "no value". */
export function localizedPayload(value: Localized): { ar: string; en: string | null } {
  const english = value.en.trim()
  return { ar: value.ar.trim(), en: english === '' ? null : english }
}

export const selectClass =
  'h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'
