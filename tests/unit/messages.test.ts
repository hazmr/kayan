import { describe, expect, it } from 'vitest'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'
import { ERROR_CODES } from '@/lib/errors/codes'

function keysOf(object: object, prefix = ''): string[] {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keysOf(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}
function valuesOf(object: object): string[] {
  return Object.values(object).flatMap((value) =>
    typeof value === 'object' && value !== null ? valuesOf(value) : [String(value)],
  )
}

describe('translations', () => {
  it('has exactly the same keys in Arabic and English', () => {
    const arabic = new Set(keysOf(ar))
    const english = new Set(keysOf(en))
    expect([...arabic].filter((key) => !english.has(key))).toEqual([])
    expect([...english].filter((key) => !arabic.has(key))).toEqual([])
  })

  it('has no empty text', () => {
    expect(valuesOf(ar).filter((text) => text.trim() === '')).toEqual([])
    expect(valuesOf(en).filter((text) => text.trim() === '')).toEqual([])
  })

  it('has Arabic text that is actually Arabic (not a leftover English copy) for every error', () => {
    for (const code of Object.keys(ERROR_CODES)) {
      const text = (ar.errors as Record<string, string>)[code]
      expect(text, `Arabic text for ${code}`).toBeTruthy()
      expect(text, `${code} should be written in Arabic`).toMatch(/[؀-ۿ]/)
    }
  })

  it('explains every API error code in both languages (the site maps codes to text)', () => {
    for (const code of Object.keys(ERROR_CODES)) {
      expect((ar.errors as Record<string, string>)[code], `ar ${code}`).toBeTruthy()
      expect((en.errors as Record<string, string>)[code], `en ${code}`).toBeTruthy()
    }
  })

  it('has no message for an error code that no longer exists', () => {
    const known = new Set(Object.keys(ERROR_CODES))
    expect(Object.keys(en.errors).filter((code) => !known.has(code))).toEqual([])
  })

  it('keeps the placeholders ({name}, {count}...) the same in both languages', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\s*[,}]/g)].map((match) => match[1]).sort()
    const enFlat = Object.fromEntries(
      keysOf(en).map((key) => [
        key,
        key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en),
      ]),
    )
    const arFlat = Object.fromEntries(
      keysOf(ar).map((key) => [
        key,
        key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], ar),
      ]),
    )
    for (const key of Object.keys(enFlat)) {
      expect(placeholders(String(arFlat[key])), key).toEqual(placeholders(String(enFlat[key])))
    }
  })
})
