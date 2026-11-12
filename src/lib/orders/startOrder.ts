import type { PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

import { lockRow } from '@/lib/db/lockRow'
import { withTransaction } from '@/lib/db/withTransaction'
import { hasRole } from '@/access/roles'
import { requireUser } from '@/lib/auth/requireActor'
import { AppError } from '@/lib/errors/AppError'
import { availableMethods, getPaymentSettings } from '@/lib/payments/settings'
import type { Order } from '@/payload-types'

import { fulfillInTransaction } from './fulfillOrder'
import { freezeAmounts, loadCourse, newReference } from './shared'
import { OPEN_ORDER_STATUSES, type PaymentMethod } from './transitions'

interface StartOrderArgs {
  courseId: string
  /** Required for paid courses. Free courses have no payment. */
  method?: PaymentMethod
  req: PayloadRequest
}

/**
 * "Buy" or "Enroll": finds the student's open order for this course, or creates one.
 * Free courses are completed on the spot. Returns `resumed: true` when an order was already open,
 * so a double click or a second tab never creates a second order.
 */
export async function startOrder({
  courseId,
  method,
  req,
}: StartOrderArgs): Promise<{ order: Order; resumed: boolean }> {
  const user = requireUser(req)
  // Doctors and staff run the platform; they never buy from it (not even their own course).
  if (!hasRole(user, 'student')) throw new AppError('ONLY_STUDENTS_CAN_BUY')
  const course = await loadCourse(courseId, req)
  if (course.status !== 'published') throw new AppError('COURSE_NOT_PURCHASABLE')

  const isFree = course.price === 0
  if (!isFree) {
    const settings = await getPaymentSettings(req.payload)
    if (!method || !availableMethods(settings).includes(method)) {
      throw new AppError('PAYMENT_METHOD_UNAVAILABLE')
    }
  }

  return withTransaction(req, async () => {
    // Everything below is "check, then create". Locking this student's row makes two clicks at
    // once take turns, so the second one finds the first one's order.
    await lockRow(req, 'users', user.id)

    const enrolled = await req.payload.count({
      collection: 'enrollments',
      where: {
        and: [
          { user: { equals: user.id } },
          { course: { equals: course.id } },
          { status: { equals: 'active' } },
        ],
      },
      overrideAccess: true,
      req,
    })
    if (enrolled.totalDocs > 0) throw new AppError('ALREADY_ENROLLED')

    const open = await req.payload.find({
      collection: 'orders',
      where: {
        and: [
          { user: { equals: user.id } },
          { course: { equals: course.id } },
          { status: { in: [...OPEN_ORDER_STATUSES] } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
    })
    if (open.docs[0]) return { order: open.docs[0], resumed: true }

    const base = {
      user: user.id,
      course: course.id,
      status: 'pending' as const,
      refundStatus: 'none' as const,
      reference: await newReference(req),
    }
    // A free course locks its (zero) amounts right away; a paid one waits for the receipt.
    const data: RequiredDataFromCollectionSlug<'orders'> = isFree
      ? { ...base, ...(await freezeAmounts(course, req, new Date())) }
      : { ...base, amount: course.price, provider: 'manual', method }

    const created = await req.payload.create({
      collection: 'orders',
      data,
      depth: 0,
      overrideAccess: true,
      req,
    })
    return { order: isFree ? await fulfillInTransaction(created, req) : created, resumed: false }
  })
}
