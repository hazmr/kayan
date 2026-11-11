import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { piastersToEgp } from '@/lib/money'
import type { OrderStatus, PaymentMethod } from '@/lib/orders/transitions'
import type { User } from '@/payload-types'

import type { Localized } from './types'

export const ORDERS_PAGE_SIZE = 25

/** Doctors only ever see orders in these statuses: the ones that are, or were, real sales. */
export const DOCTOR_VISIBLE_STATUSES = ['awaiting_review', 'paid', 'refunded'] as const

function localized(value: unknown): Localized {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >
  return {
    ar: typeof record.ar === 'string' ? record.ar : '',
    en: typeof record.en === 'string' ? record.en : '',
  }
}

interface Page<Row> {
  rows: Row[]
  page: number
  totalPages: number
  totalDocs: number
}

// ---------------------------------------------------------------------------------------------
// Managers and the owner: every order, with the details needed to run the platform.
// These run WITH access control, so Payload itself refuses anyone who is not staff.
// ---------------------------------------------------------------------------------------------

export interface OrderRow {
  reference: string
  status: OrderStatus
  method: PaymentMethod | null
  amountEgp: number
  createdAt: string
  student: { name: string; email: string }
  courseTitle: Localized
  refundRequested: boolean
}

export async function listOrdersForStaff(
  user: User,
  options: { status?: OrderStatus; search?: string; page: number },
): Promise<Page<OrderRow>> {
  const payload = await getPayload({ config })
  const filters: Where[] = []
  if (options.status) filters.push({ status: { equals: options.status } })
  const term = options.search?.trim()
  if (term) {
    filters.push({
      or: [
        { reference: { contains: term } },
        { 'user.email': { contains: term } },
        { 'user.name': { contains: term } },
      ],
    })
  }

  const result = await payload.find({
    collection: 'orders',
    where: filters.length > 0 ? { and: filters } : {},
    depth: 1,
    limit: ORDERS_PAGE_SIZE,
    page: options.page,
    sort: '-createdAt',
    locale: 'all',
    overrideAccess: false,
    user,
  })

  return {
    rows: result.docs.map((order) => {
      const student = typeof order.user === 'object' ? order.user : null
      const course = typeof order.course === 'object' ? order.course : null
      return {
        reference: order.reference,
        status: order.status,
        method: order.method ?? null,
        amountEgp: piastersToEgp(order.amount),
        createdAt: order.createdAt,
        student: { name: student?.name ?? '', email: student?.email ?? '' },
        courseTitle: localized(course?.title),
        refundRequested: order.refundStatus === 'requested',
      }
    }),
    page: result.page ?? 1,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
  }
}

// ---------------------------------------------------------------------------------------------
// Doctors: the sales of their own courses, and nothing else.
// ---------------------------------------------------------------------------------------------

/**
 * Exactly what a doctor may know about a sale. The student's email and phone, the receipt,
 * the payment method, the order reference, and refund details are not in this type, so they
 * cannot reach the page (not even as a React key, which Next.js copies into the page data).
 */
export interface SaleRow {
  status: Extract<OrderStatus, 'awaiting_review' | 'paid' | 'refunded'>
  studentName: string
  courseTitle: Localized
  amountEgp: number
  shareEgp: number
  createdAt: string
}

function isDoctorStatus(status: OrderStatus): status is SaleRow['status'] {
  return (DOCTOR_VISIBLE_STATUSES as readonly string[]).includes(status)
}

export async function listSalesForDoctor(
  user: User,
  options: { status?: SaleRow['status']; page: number },
): Promise<Page<SaleRow>> {
  const payload = await getPayload({ config })

  // Orders are not readable by doctors through the API on purpose. This function reads them on
  // the doctor's behalf, but only the ones whose doctor was locked in as this user.
  const result = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { owner: { equals: user.id } },
        {
          status: options.status
            ? { equals: options.status }
            : { in: [...DOCTOR_VISIBLE_STATUSES] },
        },
      ],
    },
    depth: 1,
    limit: ORDERS_PAGE_SIZE,
    page: options.page,
    sort: '-createdAt',
    locale: 'all',
    overrideAccess: true,
  })

  const rows: SaleRow[] = []
  for (const order of result.docs) {
    if (!isDoctorStatus(order.status)) continue
    const student = typeof order.user === 'object' ? order.user : null
    const course = typeof order.course === 'object' ? order.course : null
    rows.push({
      status: order.status,
      studentName: student?.name ?? '',
      courseTitle: localized(course?.title),
      amountEgp: piastersToEgp(order.amount),
      shareEgp: piastersToEgp(order.ownerAmount ?? 0),
      createdAt: order.createdAt,
    })
  }
  return {
    rows,
    page: result.page ?? 1,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
  }
}
