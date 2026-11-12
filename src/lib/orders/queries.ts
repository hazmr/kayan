import config from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import { relationId } from '@/collections/shared/relationId'
import type { Locale } from '@/i18n/locales'
import { getPaymentProvider } from '@/lib/payments'
import { availableMethods, getPaymentSettings } from '@/lib/payments/settings'
import { piastersToEgp } from '@/lib/money'
import type { Order, User } from '@/payload-types'

import { fulfillOrder } from './fulfillOrder'
import {
  OPEN_ORDER_STATUSES,
  type OrderStatus,
  type PaymentMethod,
  PAYMENT_METHODS,
} from './transitions'

// Read functions for the student-facing pages. Each one asks for the logged-in student's own
// records only, and returns a plain object with exactly the fields a page may show.

export type PurchaseState =
  | { kind: 'guest' }
  | { kind: 'enrolled' }
  | { kind: 'open'; reference: string; status: OrderStatus }
  | { kind: 'available' }

/** What the Buy button on a course page should do for this visitor. */
export async function getPurchaseState(
  user: User | null,
  courseId: string,
): Promise<PurchaseState> {
  if (!user) return { kind: 'guest' }
  const payload = await getPayload({ config })

  const enrolled = await payload.count({
    collection: 'enrollments',
    where: {
      and: [
        { user: { equals: user.id } },
        { course: { equals: courseId } },
        { status: { equals: 'active' } },
      ],
    },
    overrideAccess: true,
  })
  if (enrolled.totalDocs > 0) return { kind: 'enrolled' }

  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { user: { equals: user.id } },
        { course: { equals: courseId } },
        { status: { in: [...OPEN_ORDER_STATUSES] } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const open = docs[0]
  return open
    ? { kind: 'open', reference: open.reference, status: open.status }
    : { kind: 'available' }
}

export interface ReceiptView {
  id: string
  url: string
  senderNumber: string
  decision: 'approved' | 'rejected' | null
  reviewNote: string
  createdAt: string
}

export interface OrderView {
  id: string
  reference: string
  status: OrderStatus
  refundStatus: 'none' | 'requested' | 'declined'
  method: PaymentMethod | null
  /** Piasters, exactly as stored. The receipt form sends this back so a price change is caught. */
  amount: number
  amountEgp: number
  createdAt: string
  course: { id: string; slug: string; title: string }
  /** Where to send the money. Only while the student still has to pay. */
  payTo: string | null
  /** Methods the student may switch to, while the order is pending. */
  methods: PaymentMethod[]
  receipts: ReceiptView[]
  refund: { reason: string; refundTo: string; decisionNote: string } | null
}

function pickTitle(value: unknown, locale: Locale): string {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >
  const wanted = record[locale]
  const fallback = record.ar
  if (typeof wanted === 'string' && wanted !== '') return wanted
  return typeof fallback === 'string' ? fallback : ''
}

/**
 * While an order is pending its amount follows the course price, so the student always sees
 * what they would pay today. (It locks when the first receipt is uploaded.) A course that
 * became free in the meantime completes the order.
 */
async function refreshPendingOrder(order: Order, user: User): Promise<Order> {
  if (order.status !== 'pending' || order.amountFrozenAt) return order
  const payload = await getPayload({ config })
  const course = await payload.findByID({
    collection: 'courses',
    id: relationId(order.course) ?? '',
    depth: 0,
    overrideAccess: true,
  })
  if (course.price === order.amount) return order

  const updated = await payload.update({
    collection: 'orders',
    id: order.id,
    data: { amount: course.price },
    depth: 0,
    overrideAccess: true,
  })
  if (course.price === 0) {
    const req = await createLocalReq({ user }, payload)
    return fulfillOrder(updated.id, req)
  }
  return updated
}

async function toView(order: Order, locale: Locale): Promise<OrderView> {
  const payload = await getPayload({ config })
  const [course, receipts, settings] = await Promise.all([
    payload.findByID({
      collection: 'courses',
      id: relationId(order.course) ?? '',
      depth: 0,
      locale: 'all',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'receipts',
      where: { order: { equals: order.id } },
      depth: 0,
      limit: 20,
      sort: 'createdAt',
      overrideAccess: true,
    }),
    getPaymentSettings(payload),
  ])

  const method = PAYMENT_METHODS.find((candidate) => candidate === order.method) ?? null
  const stillPaying = order.status === 'pending' || order.status === 'rejected'
  let payTo: string | null = null
  if (stillPaying && method) {
    const instructions = await getPaymentProvider('manual')
      .startPayment(order, { payload })
      .catch(() => null)
    payTo = instructions?.kind === 'instructions' ? instructions.payTo : null
  }

  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    refundStatus: order.refundStatus,
    method,
    amount: order.amount,
    amountEgp: piastersToEgp(order.amount),
    createdAt: order.createdAt,
    course: {
      id: course.id,
      slug: course.slug ?? course.id,
      title: pickTitle(course.title, locale),
    },
    payTo,
    methods: order.status === 'pending' ? availableMethods(settings) : [],
    receipts: receipts.docs.map((receipt) => ({
      id: receipt.id,
      url: receipt.url ?? '',
      senderNumber: receipt.senderNumber,
      decision: receipt.decision ?? null,
      reviewNote: receipt.reviewNote ?? '',
      createdAt: receipt.createdAt,
    })),
    refund:
      order.refundStatus === 'none'
        ? null
        : {
            reason: order.refundReason ?? '',
            refundTo: order.refundTo ?? '',
            decisionNote: order.refundDecisionNote ?? '',
          },
  }
}

/** One of the student's own orders, by the reference printed on their payment page. */
export async function getMyOrder(
  reference: string,
  user: User,
  locale: Locale,
): Promise<OrderView | null> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'orders',
    where: { and: [{ reference: { equals: reference } }, { user: { equals: user.id } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const found = docs[0]
  if (!found) return null
  return toView(await refreshPendingOrder(found, user), locale)
}

export interface OrderListItem {
  reference: string
  status: OrderStatus
  amountEgp: number
  courseTitle: string
  createdAt: string
  /** A refund the student asked for and the academy has not decided yet. */
  refundRequested: boolean
}

export async function listMyOrders(user: User, locale: Locale): Promise<OrderListItem[]> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'orders',
    where: { user: { equals: user.id } },
    depth: 1,
    limit: 100,
    sort: '-createdAt',
    locale: 'all',
    overrideAccess: true,
  })
  return docs.map((order) => ({
    reference: order.reference,
    status: order.status,
    amountEgp: piastersToEgp(order.amount),
    courseTitle: typeof order.course === 'object' ? pickTitle(order.course.title, locale) : '',
    createdAt: order.createdAt,
    refundRequested: order.refundStatus === 'requested',
  }))
}
