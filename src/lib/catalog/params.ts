// What the catalog page reads from its address (?q=...&sort=...&price=...&page=...), cleaned up.
// Pure functions with no database in them, so the rules can be tested alone. Anything unknown
// falls back to the default instead of failing: a hand-edited address never breaks the page.

export const CATALOG_SORTS = ['newest', 'priceAsc', 'priceDesc'] as const
export type CatalogSort = (typeof CATALOG_SORTS)[number]

export const CATALOG_PRICES = ['all', 'free', 'paid'] as const
export type CatalogPrice = (typeof CATALOG_PRICES)[number]

export const CATALOG_PAGE_SIZE = 12
const MAX_SEARCH_LENGTH = 80

type Raw = string | string[] | undefined

function first(value: Raw): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * The search words: trimmed, shortened, and with the characters that mean "anything" to the
 * database's matching removed, so typing `%` or `_` searches for nothing special.
 */
export function cleanSearch(value: Raw): string {
  return (first(value) ?? '')
    .replace(/[%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
}

export function parseSort(value: Raw): CatalogSort {
  return CATALOG_SORTS.find((sort) => sort === value) ?? 'newest'
}

export function parsePrice(value: Raw): CatalogPrice {
  return CATALOG_PRICES.find((price) => price === value) ?? 'all'
}

/** A page number of 1 or more. Anything else is page 1. */
export function parsePage(value: Raw): number {
  const page = Number.parseInt(first(value) ?? '', 10)
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1
}

/** Payload's sort order for each choice. Ties fall back to newest, so pages never reshuffle. */
export function sortOrder(sort: CatalogSort): string[] {
  switch (sort) {
    case 'priceAsc':
      return ['price', '-createdAt']
    case 'priceDesc':
      return ['-price', '-createdAt']
    default:
      return ['-createdAt']
  }
}
