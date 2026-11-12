import { describe, expect, it } from 'vitest'

import { cleanSearch, parsePage, parsePrice, parseSort, sortOrder } from '@/lib/catalog/params'

describe('cleanSearch', () => {
  it('trims and collapses spaces', () => {
    expect(cleanSearch('  cat   surgery ')).toBe('cat surgery')
  })

  it('removes the characters that mean "anything" to the database, so they search for nothing special', () => {
    expect(cleanSearch('100%_off\\')).toBe('100 off')
    expect(cleanSearch('%')).toBe('')
  })

  it('shortens very long text', () => {
    expect(cleanSearch('x'.repeat(500))).toHaveLength(80)
  })

  it('treats a missing or repeated value as empty', () => {
    expect(cleanSearch(undefined)).toBe('')
    expect(cleanSearch(['a', 'b'])).toBe('')
  })

  it('keeps Arabic text as typed', () => {
    expect(cleanSearch(' جراحة  القطط ')).toBe('جراحة القطط')
  })
})

describe('parseSort, parsePrice, parsePage', () => {
  it('accepts the known choices and falls back to the default for anything else', () => {
    expect(parseSort('priceAsc')).toBe('priceAsc')
    expect(parseSort('priceDesc')).toBe('priceDesc')
    expect(parseSort('hacked')).toBe('newest')
    expect(parseSort(undefined)).toBe('newest')
    expect(parsePrice('free')).toBe('free')
    expect(parsePrice('paid')).toBe('paid')
    expect(parsePrice('<script>')).toBe('all')
  })

  it('a page is a whole number of 1 or more; anything else is page 1', () => {
    expect(parsePage('3')).toBe(3)
    for (const bad of [undefined, '', '0', '-2', '1.5', 'abc', '99999', ['2', '3']]) {
      expect(parsePage(bad as string), String(bad)).toBe(1)
    }
  })
})

describe('sortOrder', () => {
  it('always ends with newest, so equal prices keep a stable order between pages', () => {
    expect(sortOrder('newest')).toEqual(['-createdAt'])
    expect(sortOrder('priceAsc')).toEqual(['price', '-createdAt'])
    expect(sortOrder('priceDesc')).toEqual(['-price', '-createdAt'])
  })
})
