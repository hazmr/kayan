import config from '@payload-config'
import { getPayload } from 'payload'

import { relationId } from '@/collections/shared/relationId'
import type { PaymentMethod } from '@/lib/orders/transitions'
import { piastersToEgp } from '@/lib/money'
import type { Order, User } from '@/payload-types'

import type { Localized } from './types'
import type { ReceiptView } from '@/lib/orders/queries'

// Read functions for the manager queues. Unlike the student pages these run WITH access
// control (`overrideAccess: false` and the logged-in user): Payload itself decides that only
// managers and the owner can read other people's orders and receipts.

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

export interface QueueItem {
  id: string
  reference: string
  amountEgp: number
  method: PaymentMethod | null
  createdAt: string
  student: { name: string; email: string }
  courseTitle: Localized
  receipts: ReceiptView[]
  refund: { reason: string; refundTo: string; requestedAt: string } | null
}

async function loadQueue(
  user: User,
  where: Parameters<Awaited<ReturnType<typeof getPayload>>['find']>[0]['where'],
) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'orders',
    where,
    depth: 1,
    limit: 100,
    sort: 'updatedAt',
    locale: 'all',
    overrideAccess: false,
    user,
  })

  const receipts = docs.length
    ? await payload.find({
        collection: 'receipts',
        where: { order: { in: docs.map((order) => order.id) } },
        depth: 0,
        limit: 500,
        sort: 'createdAt',
        overrideAccess: false,
        user,
      })
    : { docs: [] }

  return docs.map((order: Order): QueueItem => {
    const student = typeof order.user === 'object' ? order.user : null
    const course = typeof order.course === 'object' ? order.course : null
    return {
      id: order.id,
      reference: order.reference,
      amountEgp: piastersToEgp(order.amount),
      method: order.method ?? null,
      createdAt: order.updatedAt,
      student: { name: student?.name ?? '', email: student?.email ?? '' },
      courseTitle: localized(course?.title),
      receipts: receipts.docs
        .filter((receipt) => relationId(receipt.order) === order.id)
        .map((receipt) => ({
          id: receipt.id,
          url: receipt.url ?? '',
          senderNumber: receipt.senderNumber,
          decision: receipt.decision ?? null,
          reviewNote: receipt.reviewNote ?? '',
          createdAt: receipt.createdAt,
        })),
      refund:
        order.refundStatus === 'requested'
          ? {
              reason: order.refundReason ?? '',
              refundTo: order.refundTo ?? '',
              requestedAt: order.refundRequestedAt ?? order.updatedAt,
            }
          : null,
    }
  })
}

/** Receipts waiting for a decision, oldest first. */
export function listAwaitingReview(user: User): Promise<QueueItem[]> {
  return loadQueue(user, { status: { equals: 'awaiting_review' } })
}

/** Paid orders whose student asked for the money back, oldest first. */
export function listRefundRequests(user: User): Promise<QueueItem[]> {
  return loadQueue(user, {
    and: [{ status: { equals: 'paid' } }, { refundStatus: { equals: 'requested' } }],
  })
}

export async function countAwaitingReview(user: User): Promise<number> {
  const payload = await getPayload({ config })
  const { totalDocs } = await payload.count({
    collection: 'orders',
    where: { status: { equals: 'awaiting_review' } },
    overrideAccess: false,
    user,
  })
  return totalDocs
}

export async function countRefundRequests(user: User): Promise<number> {
  const payload = await getPayload({ config })
  const { totalDocs } = await payload.count({
    collection: 'orders',
    where: { and: [{ status: { equals: 'paid' } }, { refundStatus: { equals: 'requested' } }] },
    overrideAccess: false,
    user,
  })
  return totalDocs
}

export async function getPaymentSettingsForStaff(user: User) {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({
    slug: 'payment-settings',
    overrideAccess: false,
    user,
  })
  return {
    instapayAddress: settings.instapayAddress ?? '',
    vodafoneCashNumber: settings.vodafoneCashNumber ?? '',
  }
}
