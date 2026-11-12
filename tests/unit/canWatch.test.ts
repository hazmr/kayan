import { describe, expect, it } from 'vitest'

import { canWatch } from '@/lib/enrollments/canWatchLesson'

describe('who may watch a lesson', () => {
  it('lets someone with the whole course watch every lesson, even in an archived course', () => {
    for (const courseStatus of ['draft', 'published', 'archived'] as const) {
      expect(canWatch({ hasFullAccess: true, courseStatus, isFreePreview: false })).toBe(true)
    }
  })

  it('lets anyone watch a free preview of a PUBLISHED course', () => {
    expect(canWatch({ hasFullAccess: false, courseStatus: 'published', isFreePreview: true })).toBe(
      true,
    )
  })

  it('keeps a free preview closed while the course is not public', () => {
    for (const courseStatus of ['draft', 'archived'] as const) {
      expect(canWatch({ hasFullAccess: false, courseStatus, isFreePreview: true })).toBe(false)
    }
  })

  it('locks every other lesson for someone without the course', () => {
    expect(
      canWatch({ hasFullAccess: false, courseStatus: 'published', isFreePreview: false }),
    ).toBe(false)
  })
})
