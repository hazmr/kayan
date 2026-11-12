import { describe, expect, it } from 'vitest'

import { lastMonths, monthKey, summarizeRevenue, type RevenueOrder } from '@/lib/earnings/revenue'

const NOW = new Date('2026-11-12T10:00:00Z')

function order(overrides: Partial<RevenueOrder> = {}): RevenueOrder {
  return {
    courseId: 'course-a',
    doctorId: 'doctor-a',
    amount: 40000,
    ownerAmount: 28000,
    status: 'paid',
    paidAt: '2026-11-05T10:00:00Z',
    ...overrides,
  }
}

describe('monthKey and lastMonths', () => {
  it('uses the Egyptian calendar, so a late-night sale lands in the right month', () => {
    // 22:30 UTC on the 31st is 00:30 on the 1st in Cairo (UTC+2 in winter).
    expect(monthKey(new Date('2026-12-31T22:30:00Z'))).toBe('2027-01')
    expect(monthKey(new Date('2026-12-31T21:30:00Z'))).toBe('2026-12')
  })

  it('lists the current month and the ones before it, newest first, across a year change', () => {
    expect(lastMonths(new Date('2026-02-10T10:00:00Z'), 4)).toEqual([
      '2026-02',
      '2026-01',
      '2025-12',
      '2025-11',
    ])
  })
})

describe('summarizeRevenue', () => {
  it('splits what students paid into the platform share and the doctors share', () => {
    const result = summarizeRevenue([order(), order()], [], NOW)
    expect(result).toMatchObject({
      gross: 80000,
      doctors: 56000,
      platform: 24000,
      sales: 2,
      paidOut: 0,
      owed: 56000,
    })
    expect(result.platform + result.doctors).toBe(result.gross)
  })

  it('keeps the leftover piaster with the platform when a share was rounded down', () => {
    // 70% of 10001 = 7000.7, rounded down when the order was frozen.
    const result = summarizeRevenue([order({ amount: 10001, ownerAmount: 7000 })], [], NOW)
    expect(result).toMatchObject({ gross: 10001, doctors: 7000, platform: 3001 })
  })

  it('leaves refunded orders out of every total and shows them on their own line', () => {
    const result = summarizeRevenue([order(), order({ status: 'refunded' })], [], NOW)
    expect(result).toMatchObject({
      gross: 40000,
      doctors: 28000,
      platform: 12000,
      sales: 1,
      refundedCount: 1,
      refundedAmount: 40000,
    })
  })

  it('counts free enrollments apart: they are not sales and carry no money', () => {
    const result = summarizeRevenue([order({ amount: 0, ownerAmount: 0 })], [], NOW)
    expect(result).toMatchObject({ gross: 0, sales: 0, freeEnrollments: 1 })
    expect(result.perCourse).toEqual([])
    expect(result.perDoctor).toEqual([])
  })

  it('subtracts payouts to get what is still owed, and the owed amount may go negative', () => {
    const paid = summarizeRevenue([order()], [{ doctorId: 'doctor-a', amount: 10000 }], NOW)
    expect(paid).toMatchObject({ paidOut: 10000, owed: 18000 })
    expect(paid.perDoctor[0]).toMatchObject({ doctorId: 'doctor-a', paidOut: 10000, owed: 18000 })

    // Paid 28000, then the order was refunded: the doctor was overpaid.
    const refundedAfterPayout = summarizeRevenue(
      [order({ status: 'refunded' })],
      [{ doctorId: 'doctor-a', amount: 28000 }],
      NOW,
    )
    expect(refundedAfterPayout.owed).toBe(-28000)
    expect(refundedAfterPayout.perDoctor[0]?.owed).toBe(-28000)
  })

  it('groups by doctor and by course, biggest first', () => {
    const result = summarizeRevenue(
      [
        order({ courseId: 'c1', doctorId: 'd1' }),
        order({ courseId: 'c2', doctorId: 'd2', amount: 100000, ownerAmount: 70000 }),
        order({ courseId: 'c2', doctorId: 'd2', amount: 100000, ownerAmount: 70000 }),
      ],
      [],
      NOW,
    )
    expect(result.perCourse.map((row) => [row.courseId, row.sales, row.gross])).toEqual([
      ['c2', 2, 200000],
      ['c1', 1, 40000],
    ])
    expect(result.perDoctor.map((row) => [row.doctorId, row.platform, row.doctors])).toEqual([
      ['d2', 60000, 140000],
      ['d1', 12000, 28000],
    ])
  })

  it('shows a doctor who only has payouts (no sales left) with a negative owed amount', () => {
    const result = summarizeRevenue([], [{ doctorId: 'd9', amount: 500 }], NOW)
    expect(result.perDoctor).toEqual([expect.objectContaining({ doctorId: 'd9', owed: -500 })])
  })

  it('buckets sales by month, with empty months included and old sales left out of the table', () => {
    const result = summarizeRevenue(
      [
        order({ paidAt: '2026-11-05T10:00:00Z' }),
        order({ paidAt: '2026-10-20T10:00:00Z' }),
        order({ paidAt: '2026-10-21T10:00:00Z' }),
        order({ paidAt: '2025-01-01T10:00:00Z' }), // far outside the last 6 months
      ],
      [],
      NOW,
    )
    expect(result.months).toHaveLength(6)
    expect(result.months[0]).toMatchObject({ month: '2026-11', sales: 1, gross: 40000 })
    expect(result.months[1]).toMatchObject({ month: '2026-10', sales: 2, gross: 80000 })
    expect(result.months[2]).toMatchObject({ month: '2026-09', sales: 0, gross: 0 })
    // The old sale still counts in the all-time total, just not in the table.
    expect(result.gross).toBe(160000)
  })
})
