import { describe, expect, it } from 'vitest'

import { groupBalances, summarizeEarnings, type EarningOrder } from '@/lib/earnings/calculate'

const paid = (courseId: string, ownerAmount: number): EarningOrder => ({
  courseId,
  ownerAmount,
  status: 'paid',
})
const refunded = (courseId: string, ownerAmount: number): EarningOrder => ({
  courseId,
  ownerAmount,
  status: 'refunded',
})

describe('balance = share of paid orders - payouts', () => {
  it('is zero for a doctor with no sales and no payouts', () => {
    expect(summarizeEarnings([], [])).toEqual({
      perCourse: [],
      totalEarned: 0,
      totalPaidOut: 0,
      balance: 0,
    })
  })

  it('adds up the share of every paid order', () => {
    const summary = summarizeEarnings([paid('a', 28000), paid('a', 28000), paid('b', 17500)], [])
    expect(summary.totalEarned).toBe(73500)
    expect(summary.balance).toBe(73500)
  })

  it('subtracts payouts', () => {
    const summary = summarizeEarnings(
      [paid('a', 28000), paid('a', 28000)],
      [{ amount: 30000 }, { amount: 6000 }],
    )
    expect(summary.totalEarned).toBe(56000)
    expect(summary.totalPaidOut).toBe(36000)
    expect(summary.balance).toBe(20000)
  })

  it('does not count refunded orders as earnings', () => {
    const summary = summarizeEarnings([paid('a', 28000), refunded('a', 28000)], [])
    expect(summary.totalEarned).toBe(28000)
  })

  it('goes negative when a refund comes after a payout, and recovers with the next sale', () => {
    const payouts = [{ amount: 56000 }]
    // two sales, the doctor was paid for both, then one is refunded
    expect(summarizeEarnings([paid('a', 28000), refunded('a', 28000)], payouts).balance).toBe(
      -28000,
    )
    // a new sale covers part of the debt
    expect(
      summarizeEarnings([paid('a', 28000), refunded('a', 28000), paid('a', 28000)], payouts)
        .balance,
    ).toBe(0)
  })

  it('reports an over-payment as a negative balance', () => {
    expect(summarizeEarnings([paid('a', 10000)], [{ amount: 15000 }]).balance).toBe(-5000)
  })

  it('counts paid and refunded orders per course, and sorts by what each course earned', () => {
    const { perCourse } = summarizeEarnings(
      [paid('small', 1000), paid('big', 5000), paid('big', 5000), refunded('big', 5000)],
      [],
    )
    expect(perCourse).toEqual([
      { courseId: 'big', paidOrders: 2, refundedOrders: 1, earned: 10000 },
      { courseId: 'small', paidOrders: 1, refundedOrders: 0, earned: 1000 },
    ])
  })

  it('keeps a course that only has refunded orders, earning nothing', () => {
    const { perCourse, totalEarned } = summarizeEarnings([refunded('a', 28000)], [])
    expect(perCourse).toEqual([{ courseId: 'a', paidOrders: 0, refundedOrders: 1, earned: 0 }])
    expect(totalEarned).toBe(0)
  })

  it('is exact: whole piasters in, whole piasters out', () => {
    const orders = Array.from({ length: 1000 }, () => paid('a', 33333))
    expect(summarizeEarnings(orders, [{ amount: 1 }]).balance).toBe(33333000 - 1)
  })
})

describe('groupBalances (the owner overview)', () => {
  it('computes each doctor separately in one pass', () => {
    const balances = groupBalances(
      [
        { doctorId: 'x', ownerAmount: 28000 },
        { doctorId: 'x', ownerAmount: 28000 },
        { doctorId: 'y', ownerAmount: 17500 },
      ],
      [{ doctorId: 'x', amount: 30000 }],
    )
    expect(balances.get('x')).toEqual({
      doctorId: 'x',
      earned: 56000,
      paidOut: 30000,
      balance: 26000,
    })
    expect(balances.get('y')).toEqual({ doctorId: 'y', earned: 17500, paidOut: 0, balance: 17500 })
  })

  it('includes a doctor who has only been paid (a negative balance)', () => {
    const balances = groupBalances([], [{ doctorId: 'z', amount: 5000 }])
    expect(balances.get('z')?.balance).toBe(-5000)
  })

  it('agrees with summarizeEarnings for the same data', () => {
    const orders = [paid('a', 28000), paid('b', 12345)]
    const payouts = [{ amount: 9999 }]
    const single = summarizeEarnings(orders, payouts)
    const grouped = groupBalances(
      orders.map((order) => ({ doctorId: 'd', ownerAmount: order.ownerAmount })),
      payouts.map((payout) => ({ doctorId: 'd', amount: payout.amount })),
    ).get('d')
    expect(grouped?.balance).toBe(single.balance)
  })
})
