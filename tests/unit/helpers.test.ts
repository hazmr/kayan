import { describe, expect, it } from 'vitest'

import { resolveSlug, slugify } from '@/collections/shared/slug'
import { safeNext } from '@/lib/auth/safeNext'
import { parseYouTubeId } from '@/lib/video/parseYouTubeId'

describe('parseYouTubeId (doctors paste whatever they copied)', () => {
  const id = 'dQw4w9WgXcQ'
  it.each([
    [id],
    [`  ${id}  `],
    [`https://www.youtube.com/watch?v=${id}`],
    [`https://www.youtube.com/watch?v=${id}&t=10s`],
    [`https://youtube.com/watch?v=${id}&list=PL123`],
    [`https://m.youtube.com/watch?v=${id}`],
    [`https://youtu.be/${id}`],
    [`https://youtu.be/${id}?t=10`],
    [`https://www.youtube.com/embed/${id}`],
    [`https://www.youtube.com/shorts/${id}`],
    [`https://www.youtube-nocookie.com/embed/${id}`],
  ])('finds the id in %s', (input) => {
    expect(parseYouTubeId(input)).toBe(id)
  })

  it.each([
    [''],
    ['not a link'],
    ['https://vimeo.com/123456789'],
    ['https://evil.example/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/'],
    ['https://www.youtube.com/watch'],
    ['https://www.youtube.com/channel/UC1234567890'],
    ['javascript:alert(1)'],
  ])('rejects %j', (input) => {
    expect(parseYouTubeId(input)).toBeNull()
  })
})

describe('safeNext (log in, then go back where you were)', () => {
  it('accepts a path on this site', () => {
    expect(safeNext('/checkout/some-course')).toBe('/checkout/some-course')
    expect(safeNext('/orders/VT-ABC234')).toBe('/orders/VT-ABC234')
  })

  it.each([
    ['https://evil.example'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['evil.example'],
    ['javascript:alert(1)'],
    ['/redirect?to=https://evil.example'],
    [''],
    ['/'],
  ])('rejects %j', (value) => {
    expect(safeNext(value)).toBeUndefined()
  })

  it('rejects anything that is not a single string', () => {
    expect(safeNext(undefined)).toBeUndefined()
    expect(safeNext(['/a', '/b'])).toBeUndefined()
  })
})

describe('slugs', () => {
  it('makes readable Latin slugs', () => {
    expect(slugify('Equine Surgery 101')).toBe('equine-surgery-101')
    expect(slugify('  --Hello,   World!--  ')).toBe('hello-world')
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu')
  })

  it('gives nothing for a pure Arabic title, so a code is used instead', () => {
    expect(slugify('جراحة الخيول')).toBe('')
    expect(resolveSlug(undefined, 'جراحة الخيول', 'course')).toMatch(/^course-[a-z0-9]{1,6}$/)
  })

  it('prefers what the editor typed, then the title', () => {
    expect(resolveSlug(' my-slug ', 'Other title', 'course')).toBe('my-slug')
    expect(resolveSlug('', 'Other title', 'course')).toBe('other-title')
    expect(resolveSlug(undefined, { ar: 'عربي', en: 'English Title' }, 'course')).toBe(
      'english-title',
    )
  })

  it('caps the length', () => {
    expect(slugify('a'.repeat(300)).length).toBeLessThanOrEqual(80)
  })
})
