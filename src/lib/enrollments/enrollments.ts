import type { PayloadRequest } from 'payload'

import { relationId } from '@/collections/shared/relationId'
import type { Enrollment, Order } from '@/payload-types'

async function findEnrollment(order: Order, req: PayloadRequest): Promise<Enrollment | null> {
  const { docs } = await req.payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { user: { equals: relationId(order.user) } },
        { course: { equals: relationId(order.course) } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  })
  return docs[0] ?? null
}

/**
 * Gives the student access to the course. If they were refunded before, their old enrollment
 * is switched back on instead of creating a second one (there is one per student per course).
 */
export async function activateEnrollment(order: Order, req: PayloadRequest): Promise<void> {
  const existing = await findEnrollment(order, req)
  if (existing) {
    await req.payload.update({
      collection: 'enrollments',
      id: existing.id,
      data: { status: 'active', order: order.id },
      overrideAccess: true,
      req,
    })
    return
  }
  await req.payload.create({
    collection: 'enrollments',
    data: {
      user: relationId(order.user) ?? '',
      course: relationId(order.course) ?? '',
      order: order.id,
      status: 'active',
    },
    overrideAccess: true,
    req,
  })
}

/** Takes the access away after a refund. Safe to call when there is nothing to revoke. */
export async function revokeEnrollment(order: Order, req: PayloadRequest): Promise<void> {
  const existing = await findEnrollment(order, req)
  if (!existing || existing.status === 'revoked') return
  await req.payload.update({
    collection: 'enrollments',
    id: existing.id,
    data: { status: 'revoked' },
    overrideAccess: true,
    req,
  })
}

export async function hasActiveEnrollment(
  userId: string,
  courseId: string,
  req: Pick<PayloadRequest, 'payload'> & Partial<PayloadRequest>,
): Promise<boolean> {
  const { totalDocs } = await req.payload.count({
    collection: 'enrollments',
    where: {
      and: [
        { user: { equals: userId } },
        { course: { equals: courseId } },
        { status: { equals: 'active' } },
      ],
    },
    overrideAccess: true,
    req: req as PayloadRequest,
  })
  return totalDocs > 0
}
