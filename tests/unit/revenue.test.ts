import { describe, expect, it } from 'vitest'

import { lastMonths, monthKey, summarizeRevenue, type RevenueOrder } from '@/lib/earnings/revenue'

const NOW = new Date('2026-11-12T10:00:00Z')

// A EGP 400 sale with the Admin on 30%: EGP 120 to the Admin, EGP 280 stays with the academy.
function order(overrides: Partial<RevenueOrder> = {}): RevenueOrder {
  return {
    courseId: 'course-a',
    amount: 40000,
    adminAmount: 12000,
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
  it("splits what students paid into the academy's share and the Admin's share", () => {
    const result = summarizeRevenue([order(), order()], [], NOW)
    expect(result).toMatchObject({
      gross: 80000,
      admin: 24000,
      academy: 56000,
      sales: 2,
      paidToAdmin: 0,
      owedToAdmin: 24000,
    })
    expect(result.admin + result.academy).toBe(result.gross)
  })

  it('uses the share frozen on each order, so sales made at different percents add up correctly', () => {
    const result = summarizeRevenue(
      [order({ adminAmount: 12000 }), order({ adminAmount: 4000 })], // 30% then 10%
      [],
      NOW,
    )
    expect(result).toMatchObject({ gross: 80000, admin: 16000, academy: 64000 })
  })

  it('keeps the leftover piaster with the academy when the share was rounded down', () => {
    // 30% of 10001 = 3000.3, rounded down when the order was frozen.
    const result = summarizeRevenue([order({ amount: 10001, adminAmount: 3000 })], [], NOW)
    expect(result).toMatchObject({ gross: 10001, admin: 3000, academy: 7001 })
  })

  it('leaves refunded orders out of every total and shows them on their own line', () => {
    const result = summarizeRevenue([order(), order({ status: 'refunded' })], [], NOW)
    expect(result).toMatchObject({
      gross: 40000,
      admin: 12000,
      academy: 28000,
      sales: 1,
      refundedCount: 1,
      refundedAmount: 40000,
    })
  })

  it('counts free enrollments apart: they are not sales and carry no money', () => {
    const result = summarizeRevenue([order({ amount: 0, adminAmount: 0 })], [], NOW)
    expect(result).toMatchObject({ gross: 0, sales: 0, freeEnrollments: 1 })
    expect(result.perCourse).toEqual([])
  })

  it('subtracts payments to the Admin, and what is owed may go negative after a refund', () => {
    expect(summarizeRevenue([order()], [{ amount: 5000 }], NOW)).toMatchObject({
      paidToAdmin: 5000,
      owedToAdmin: 7000,
    })
    // Paid 12000, then the order was refunded: the Admin was paid in advance.
    expect(
      summarizeRevenue([order({ status: 'refunded' })], [{ amount: 12000 }], NOW).owedToAdmin,
    ).toBe(-12000)
  })

  it('groups by course, biggest first', () => {
    const result = summarizeRevenue(
      [
        order({ courseId: 'c1' }),
        order({ courseId: 'c2', amount: 100000, adminAmount: 30000 }),
        order({ courseId: 'c2', amount: 100000, adminAmount: 30000 }),
      ],
      [],
      NOW,
    )
    expect(result.perCourse.map((row) => [row.courseId, row.sales, row.gross, row.admin])).toEqual([
      ['c2', 2, 200000, 60000],
      ['c1', 1, 40000, 12000],
    ])
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
    expect(result.months[0]).toMatchObject({
      month: '2026-11',
      sales: 1,
      gross: 40000,
      admin: 12000,
    })
    expect(result.months[1]).toMatchObject({ month: '2026-10', sales: 2, gross: 80000 })
    expect(result.months[2]).toMatchObject({ month: '2026-09', sales: 0, gross: 0 })
    // The old sale still counts in the all-time total, just not in the table.
    expect(result.gross).toBe(160000)
  })
})
