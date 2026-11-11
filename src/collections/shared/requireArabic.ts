import type { CollectionBeforeValidateHook } from 'payload'

import { DEFAULT_LOCALE } from '@/i18n/locales'
import { AppError } from '@/lib/errors/AppError'

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

/**
 * Every translated document must have Arabic text. English is optional.
 *
 * Why a hook instead of `required: true`: for a translated field, `required` means
 * "required in every language", which would make English mandatory.
 *
 * A field arrives in one of two shapes:
 *   { ar, en }  when the dashboard saves both languages at once (?locale=all)
 *   "text"      when one language is saved; it is Arabic only if the request's locale is Arabic
 */
export function requireArabic(fields: readonly string[]): CollectionBeforeValidateHook {
  return ({ data, operation, req }) => {
    if (!data) return data
    const record = data as Record<string, unknown>

    for (const field of fields) {
      const value = record[field]

      if (typeof value === 'object' && value !== null) {
        if (isBlank((value as Record<string, unknown>)[DEFAULT_LOCALE])) {
          throw new AppError('VALIDATION_FAILED')
        }
        continue
      }

      const savingArabic = !req.locale || req.locale === DEFAULT_LOCALE
      if (operation === 'create') {
        // A new document must start with its Arabic text.
        if (!savingArabic || isBlank(value)) throw new AppError('VALIDATION_FAILED')
      } else if (value !== undefined && savingArabic && isBlank(value)) {
        // An update may leave the field out, but may not blank the Arabic text.
        throw new AppError('VALIDATION_FAILED')
      }
    }
    return data
  }
}
