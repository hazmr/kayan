// The owner's money overview as plain functions with no database in them, so it can be tested alone.
//
//   what students paid  =  the platform's share  +  the doctors' share
//   the doctors' share  =  paid out already       +  still owed
//
// Only PAID orders count as revenue. A refunded order drops out of every total (the same rule as a
// doctor's balance) and is shown on its own line so the owner sees how much was given back.
// All amounts are whole piasters.

export interface RevenueOrder {
  courseId: string
  doctorId: string
  /** What the student paid. */
  amount: number
  /** The doctor's share of it, locked in when the receipt was uploaded. */
  ownerAmount: number
  status: 'paid' | 'refunded'
  /** ISO date of the payment. Decides which month the sale belongs to. */
  paidAt: string | null
}

export interface MoneySplit {
  /** What students paid. */
  gross: number
  /** The platform's (owner's) share: gross minus the doctors' share. */
  platform: number
  doctors: number
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

export interface DoctorRevenue extends MoneySplit {
  doctorId: string
  sales: number
  paidOut: number
  /** The doctor's share minus what was paid out. Negative when a refund came after a payout. */
  owed: number
}

export interface RevenueSummary extends MoneySplit {
  /** Paid orders that cost something. Free enrollments are counted apart. */
  sales: number
  freeEnrollments: number
  refundedCount: number
  refundedAmount: number
  paidOut: number
  owed: number
  /** Newest first, the last N months including the current one (zero months included). */
  months: MonthRevenue[]
  perCourse: CourseRevenue[]
  perDoctor: DoctorRevenue[]
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
  return { gross: 0, platform: 0, doctors: 0 }
}

function add(split: MoneySplit, order: RevenueOrder) {
  split.gross += order.amount
  split.doctors += order.ownerAmount
  split.platform += order.amount - order.ownerAmount
}

export function summarizeRevenue(
  orders: readonly RevenueOrder[],
  payouts: readonly { doctorId: string; amount: number }[],
  now: Date,
  monthCount = 6,
): RevenueSummary {
  const total = emptySplit()
  const months = new Map<string, MonthRevenue>(
    lastMonths(now, monthCount).map((month) => [month, { month, sales: 0, ...emptySplit() }]),
  )
  const courses = new Map<string, CourseRevenue>()
  const doctors = new Map<string, DoctorRevenue>()
  const doctor = (doctorId: string): DoctorRevenue => {
    const found = doctors.get(doctorId) ?? {
      doctorId,
      sales: 0,
      paidOut: 0,
      owed: 0,
      ...emptySplit(),
    }
    doctors.set(doctorId, found)
    return found
  }

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

    const owner = doctor(order.doctorId)
    owner.sales += 1
    add(owner, order)

    const month = order.paidAt ? months.get(monthKey(new Date(order.paidAt))) : undefined
    if (month) {
      month.sales += 1
      add(month, order)
    }
  }

  let paidOut = 0
  for (const payout of payouts) {
    paidOut += payout.amount
    doctor(payout.doctorId).paidOut += payout.amount
  }
  for (const item of doctors.values()) item.owed = item.doctors - item.paidOut

  return {
    ...total,
    sales,
    freeEnrollments,
    refundedCount,
    refundedAmount,
    paidOut,
    owed: total.doctors - paidOut,
    months: [...months.values()],
    perCourse: [...courses.values()].sort((a, b) => b.gross - a.gross),
    perDoctor: [...doctors.values()].sort((a, b) => b.gross - a.gross),
  }
}
