import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { piastersToEgp } from '@/lib/money'
import type { OrderStatus, PaymentMethod } from '@/lib/orders/transitions'
import type { User } from '@/payload-types'

import type { Localized } from './types'

export const ORDERS_PAGE_SIZE = 25

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
// The Admin and instructors: every order, with the details needed to run the academy.
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
