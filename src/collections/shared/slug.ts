import type { Field } from 'payload'

import { label } from './labels'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** "Equine Surgery 101" -> "equine-surgery-101". Returns '' when nothing Latin is left (Arabic titles). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** A title arrives as plain text, or as { ar, en } when both languages are saved at once. */
function titleText(title: unknown): string {
  if (typeof title === 'string') return title
  if (
    typeof title === 'object' &&
    title !== null &&
    'en' in title &&
    typeof title.en === 'string'
  ) {
    return title.en
  }
  return ''
}

function shortCode(): string {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * The slug to store: what the editor typed, else one made from the title,
 * else `<prefix>-<short code>` when the title has no Latin letters.
 */
export function resolveSlug(typed: unknown, title: unknown, prefix: string): string {
  if (typeof typed === 'string' && typed.trim() !== '') return typed.trim()
  const fromTitle = slugify(titleText(title))
  return fromTitle !== '' ? fromTitle : `${prefix}-${shortCode()}`
}

/** The URL name of a document. Latin only, so links stay readable when shared. */
export const slugField: Field = {
  name: 'slug',
  type: 'text',
  label: label('URL name', 'الاسم في الرابط'),
  unique: true,
  index: true,
  maxLength: 80,
  admin: {
    position: 'sidebar',
    description: label(
      'Lowercase English letters, numbers, and dashes. Leave empty to generate one.',
      'حروف إنجليزية صغيرة وأرقام وشرطات. اتركه فارغاً ليتم إنشاؤه تلقائياً.',
    ),
  },
  validate: (value: unknown) => {
    if (typeof value !== 'string' || value === '') return true // filled in by a hook
    return SLUG_PATTERN.test(value) || 'Use lowercase English letters, numbers, and dashes only.'
  },
}
