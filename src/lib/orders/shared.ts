import { randomInt } from 'crypto'
import type { PayloadRequest } from 'payload'

import { relationId } from '@/collections/shared/relationId'
import { DEFAULT_ADMIN_SHARE_PERCENT } from '@/globals/PlatformSettings'
import { lockRow } from '@/lib/db/lockRow'
import { courseTitleOf, type OrderEmailContext } from '@/lib/email/orderEmails'
import { AppError } from '@/lib/errors/AppError'
import { adminShare } from '@/lib/money'
import type { Course, Order, User } from '@/payload-types'

/** Locks the order row and returns its fresh state. Call inside withTransaction. */
export async function lockOrder(orderId: string, req: PayloadRequest): Promise<Order> {
  await lockRow(req, 'orders', orderId)
  const order = await req.payload
    .findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!order) throw new AppError('NOT_FOUND')
  return order
}

/** Someone else's order looks exactly like a missing one, so ids cannot be probed. */
export function assertOwnsOrder(order: Order, user: User): void {
  if (relationId(order.user) !== user.id) throw new AppError('NOT_FOUND')
}

export async function loadCourse(courseId: string, req: PayloadRequest): Promise<Course> {
  const course = await req.payload
    .findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!course) throw new AppError('NOT_FOUND')
  return course
}

/**
 * The numbers an order locks in the moment the student commits (uploads a receipt, or enrolls
 * in a free course): the price, and the Admin's share of it at today's percent.
 * Later changes to the price or the percent never touch this order.
 */
export async function freezeAmounts(course: Course, req: PayloadRequest, now: Date) {
  const settings = await req.payload.findGlobal({
    slug: 'platform-settings',
    overrideAccess: true,
    req,
  })
  const percent = settings.adminSharePercent ?? DEFAULT_ADMIN_SHARE_PERCENT
  return {
    amount: course.price,
    adminAmount: adminShare(course.price, percent),
    amountFrozenAt: now.toISOString(),
  }
}

// No 0/O or 1/I, which are easy to mix up when typing a code from a screenshot.
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/** A short code like KY-7K3M9Q that the student writes in the transfer note. */
export async function newReference(req: PayloadRequest): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]
    const reference = `KY-${code}`
    const { totalDocs } = await req.payload.count({
      collection: 'orders',
      where: { reference: { equals: reference } },
      overrideAccess: true,
      req,
    })
    if (totalDocs === 0) return reference
  }
  throw new AppError('INTERNAL_ERROR')
}

/** What the order emails need, loaded after the change is saved. */
export async function emailContextFor(
  order: Order,
  req: PayloadRequest,
): Promise<OrderEmailContext> {
  const studentId = relationId(order.user) ?? ''
  const student = await req.payload.findByID({
    collection: 'users',
    id: studentId,
    depth: 0,
    overrideAccess: true,
  })
  return {
    order,
    student: { name: student.name, email: student.email },
    courseTitle: await courseTitleOf(req.payload, relationId(order.course) ?? ''),
    payload: req.payload,
  }
}
