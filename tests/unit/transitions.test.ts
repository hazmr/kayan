import { describe, expect, it } from 'vitest'

import { COURSE_STATUSES, COURSE_TRANSITIONS, nextStatusesFor } from '@/lib/courses/transitions'
import { AppError } from '@/lib/errors/AppError'
import {
  assertTransition,
  OPEN_ORDER_STATUSES,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
} from '@/lib/orders/transitions'

describe('order status diagram', () => {
  const allowed: [string, string][] = [
    ['pending', 'awaiting_review'],
    ['pending', 'paid'], // free courses only; fulfillOrder checks the amount
    ['pending', 'cancelled'],
    ['awaiting_review', 'paid'],
    ['awaiting_review', 'rejected'],
    ['rejected', 'awaiting_review'],
    ['rejected', 'cancelled'],
    ['paid', 'refunded'],
  ]

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(() => assertTransition(from as never, to as never)).not.toThrow()
  })

  it('refuses every other move with ORDER_INVALID_STATE', () => {
    const forbidden = ORDER_STATUSES.flatMap((from) =>
      ORDER_STATUSES.filter((to) => !allowed.some(([a, b]) => a === from && b === to)).map(
        (to) => [from, to] as const,
      ),
    )
    expect(forbidden.length).toBeGreaterThan(20)
    for (const [from, to] of forbidden) {
      expect(() => assertTransition(from, to), `${from} -> ${to}`).toThrow(AppError)
      try {
        assertTransition(from, to)
      } catch (error) {
        expect(error).toMatchObject({ code: 'ORDER_INVALID_STATE', status: 409 })
      }
    }
  })

  it('has no way out of refunded or cancelled', () => {
    expect(ORDER_TRANSITIONS.refunded).toEqual([])
    expect(ORDER_TRANSITIONS.cancelled).toEqual([])
  })

  it('only pending, awaiting_review and rejected count as open (one per student per course)', () => {
    expect([...OPEN_ORDER_STATUSES].sort()).toEqual(['awaiting_review', 'pending', 'rejected'])
  })
})

describe('course status diagram', () => {
  it('goes draft -> published -> archived -> published, with no review step', () => {
    expect(nextStatusesFor('draft')).toEqual(['published'])
    expect(nextStatusesFor('published')).toEqual(['archived'])
    expect(nextStatusesFor('archived')).toEqual(['published'])
  })

  it('never goes back to draft once a course has been published', () => {
    for (const status of COURSE_STATUSES) {
      if (status !== 'draft') expect(COURSE_TRANSITIONS[status]).not.toContain('draft')
    }
  })

  it('has exactly three statuses', () => {
    expect([...COURSE_STATUSES].sort()).toEqual(['archived', 'draft', 'published'])
  })
})
