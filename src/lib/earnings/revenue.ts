// The academy's money as plain functions with no database in them, so they can be tested alone.
//
//   what students paid  =  the academy's share  +  the Admin's share
//   the Admin's share   =  paid to the Admin    +  still owed to the Admin
//
// Only PAID orders count. A refunded order drops out of every total and is shown on its own line,
// so a refund after the Admin was paid simply makes "owed" go negative. All amounts are piasters.

export interface RevenueOrder {
  courseId: string
  /** What the student paid. */
  amount: number
  /** The Admin's share of it, frozen when the student paid. */
  adminAmount: number
  status: 'paid' | 'refunded'
  /** ISO date of the payment. Decides which month the sale belongs to. */
  paidAt: string | null
}

export interface MoneySplit {
  /** What students paid. */
  gross: number
  /** The Admin's share. */
  admin: number
  /** What the academy keeps: gross minus the Admin's share. */
  academy: number
}

export interface MonthRevenue extends MoneySplit {
  /** "2026-11", in Cairo time. */
  month: string
  sales: number
}

export interface CourseRevenue extends MoneySplit {
  courseId: string
  sales: number
}

export interface RevenueSummary extends MoneySplit {
  /** Paid orders that cost something. Free enrollments are counted apart. */
  sales: number
  freeEnrollments: number
  refundedCount: number
  refundedAmount: number
  paidToAdmin: number
  /** The Admin's share minus what was paid to them. Negative when a refund came after a payment. */
  owedToAdmin: number
  /** Newest first, the last N months including the current one (zero months included). */
  months: MonthRevenue[]
  perCourse: CourseRevenue[]
}

const MONTH_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
})

/** "2026-11" for a date, using Egypt's calendar so a sale at 1 a.m. on the 1st lands in the new month. */
export function monthKey(date: Date): string {
  const parts = MONTH_FORMAT.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '00'
  return `${year}-${month}`
}

/** The month keys of the last `count` months, newest first. */
export function lastMonths(now: Date, count: number): string[] {
  const [year, month] = monthKey(now).split('-').map(Number) as [number, number]
  return Array.from({ length: count }, (_, back) => {
    const index = year * 12 + (month - 1) - back
    const y = Math.floor(index / 12)
    const m = (index % 12) + 1
    return `${y}-${String(m).padStart(2, '0')}`
  })
}

function emptySplit(): MoneySplit {
  return { gross: 0, admin: 0, academy: 0 }
}

function add(split: MoneySplit, order: RevenueOrder) {
  split.gross += order.amount
  split.admin += order.adminAmount
  split.academy += order.amount - order.adminAmount
}

export function summarizeRevenue(
  orders: readonly RevenueOrder[],
  payments: readonly { amount: number }[],
  now: Date,
  monthCount = 6,
): RevenueSummary {
  const total = emptySplit()
  const months = new Map<string, MonthRevenue>(
    lastMonths(now, monthCount).map((month) => [month, { month, sales: 0, ...emptySplit() }]),
  )
  const courses = new Map<string, CourseRevenue>()
  let sales = 0
  let freeEnrollments = 0
  let refundedCount = 0
  let refundedAmount = 0

  for (const order of orders) {
    if (order.status === 'refunded') {
      if (order.amount > 0) {
        refundedCount += 1
        refundedAmount += order.amount
      }
      continue
    }
    if (order.amount === 0) {
      freeEnrollments += 1
      continue
    }

    sales += 1
    add(total, order)

    const course = courses.get(order.courseId) ?? {
      courseId: order.courseId,
      sales: 0,
      ...emptySplit(),
    }
    course.sales += 1
    add(course, order)
    courses.set(order.courseId, course)

    const month = order.paidAt ? months.get(monthKey(new Date(order.paidAt))) : undefined
    if (month) {
      month.sales += 1
      add(month, order)
    }
  }

  const paidToAdmin = payments.reduce((sum, payment) => sum + payment.amount, 0)
  return {
    ...total,
    sales,
    freeEnrollments,
    refundedCount,
    refundedAmount,
    paidToAdmin,
    owedToAdmin: total.admin - paidToAdmin,
    months: [...months.values()],
    perCourse: [...courses.values()].sort((a, b) => b.gross - a.gross),
  }
}
