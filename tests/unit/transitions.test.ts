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
  it('lets a doctor only send a draft for review', () => {
    expect(nextStatusesFor('draft', ['owner'])).toEqual(['in_review'])
    expect(nextStatusesFor('in_review', ['owner'])).toEqual([])
    expect(nextStatusesFor('published', ['owner'])).toEqual([])
    expect(nextStatusesFor('archived', ['owner'])).toEqual([])
  })

  it('lets managers and the owner publish, send back, archive, and unarchive', () => {
    for (const actor of ['manager', 'superadmin'] as const) {
      expect(nextStatusesFor('draft', [actor])).toEqual(['in_review'])
      expect(nextStatusesFor('in_review', [actor]).sort()).toEqual(['draft', 'published'])
      expect(nextStatusesFor('published', [actor])).toEqual(['archived'])
      expect(nextStatusesFor('archived', [actor])).toEqual(['published'])
    }
  })

  it('offers nothing to someone with no claim on the course', () => {
    for (const status of COURSE_STATUSES) expect(nextStatusesFor(status, [])).toEqual([])
  })

  it('never lets a course go straight from draft to published', () => {
    expect(COURSE_TRANSITIONS.draft.published).toBeUndefined()
  })
})
