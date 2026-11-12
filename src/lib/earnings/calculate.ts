// The money rules, as plain functions with no database in them, so they can be tested alone.
//
//   balance(doctor) = sum of the doctor's share on PAID orders  -  sum of payouts recorded for them
//
// A refunded order is no longer "paid", so it simply drops out of the first sum. That is the
// whole "negative balance after a refund" rule: no special case is needed.
// All amounts are whole piasters.

export interface EarningOrder {
  courseId: string
  /** The doctor's share of this order, locked in when the receipt was uploaded. */
  ownerAmount: number
  status: 'paid' | 'refunded'
}

export interface CourseEarnings {
  courseId: string
  paidOrders: number
  refundedOrders: number
  /** Only paid orders count. */
  earned: number
}

export interface EarningsSummary {
  perCourse: CourseEarnings[]
  totalEarned: number
  totalPaidOut: number
  /** Earned minus paid out. Negative when a refund came after a payout. */
  balance: number
}

export function summarizeEarnings(
  orders: readonly EarningOrder[],
  payouts: readonly { amount: number }[],
): EarningsSummary {
  const byCourse = new Map<string, CourseEarnings>()
  for (const order of orders) {
    const entry = byCourse.get(order.courseId) ?? {
      courseId: order.courseId,
      paidOrders: 0,
      refundedOrders: 0,
      earned: 0,
    }
    if (order.status === 'paid') {
      entry.paidOrders += 1
      entry.earned += order.ownerAmount
    } else {
      entry.refundedOrders += 1
    }
    byCourse.set(order.courseId, entry)
  }

  const perCourse = [...byCourse.values()].sort((a, b) => b.earned - a.earned)
  const totalEarned = perCourse.reduce((sum, course) => sum + course.earned, 0)
  const totalPaidOut = payouts.reduce((sum, payout) => sum + payout.amount, 0)
  return { perCourse, totalEarned, totalPaidOut, balance: totalEarned - totalPaidOut }
}

export interface DoctorBalance {
  doctorId: string
  earned: number
  paidOut: number
  balance: number
}

/** The same rule for many doctors at once (the owner's overview), in a single pass. */
export function groupBalances(
  orders: readonly { doctorId: string; ownerAmount: number }[],
  payouts: readonly { doctorId: string; amount: number }[],
): Map<string, DoctorBalance> {
  const result = new Map<string, DoctorBalance>()
  const entry = (doctorId: string): DoctorBalance => {
    const existing = result.get(doctorId) ?? { doctorId, earned: 0, paidOut: 0, balance: 0 }
    result.set(doctorId, existing)
    return existing
  }
  for (const order of orders) entry(order.doctorId).earned += order.ownerAmount
  for (const payout of payouts) entry(payout.doctorId).paidOut += payout.amount
  for (const item of result.values()) item.balance = item.earned - item.paidOut
  return result
}
