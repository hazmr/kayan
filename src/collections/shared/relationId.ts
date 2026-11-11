/**
 * A relationship field holds either the related id or the whole related document,
 * depending on how deep the query populated. This returns the id in both cases.
 */
export function relationId(value: string | { id: string } | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value : value.id
}
