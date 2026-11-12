import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
} from 'payload'

import { isStaff, roleOf } from '@/access/roles'
import { AppError } from '@/lib/errors/AppError'
import type { Course } from '@/payload-types'

import { relationId } from '../shared/relationId'
import { resolveSlug } from '../shared/slug'

export const fillSlug: CollectionBeforeValidateHook<Course> = ({ data, originalDoc }) => {
  if (!data) return data
  data.slug = resolveSlug(data.slug ?? originalDoc?.slug, data.title, 'course')
  return data
}

/**
 * New courses always start as a draft. An instructor who creates a course teaches it; the
 * Admin picks the instructor. This runs before validation, so the required `owner` is filled in.
 */
export const setCreationDefaults: CollectionBeforeValidateHook<Course> = async ({
  data,
  operation,
  req,
}) => {
  if (!data || operation !== 'create') return data

  data.status = 'draft'

  // Only staff may create a course for someone else. Everyone else owns what they create.
  if (req.user && !(isStaff(req.user) && data.owner)) {
    data.owner = req.user.id
  }
  return data
}

/** The person shown as teaching the course must be an instructor account. */
export const requireDoctorOwner: CollectionBeforeChangeHook<Course> = async ({
  data,
  originalDoc,
  req,
}) => {
  const ownerId = relationId(data.owner)
  if (!ownerId || ownerId === relationId(originalDoc?.owner)) return data

  const owner = await req.payload
    .findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (roleOf(owner) !== 'admin') throw new AppError('COURSE_OWNER_INVALID')
  return data
}

/** Deleting a course removes its lessons and modules first, inside the same transaction. */
export const deleteCourseContent: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'lessons',
    where: { course: { equals: id } },
    overrideAccess: true,
    req,
  })
  await req.payload.delete({
    collection: 'modules',
    where: { course: { equals: id } },
    overrideAccess: true,
    req,
  })
}

/**
 * A course that has orders or students is archived, never deleted: students keep access and
 * the money records stay intact. (Orders also point at the course, so deleting would fail.)
 */
export const refuseDeleteWhenSold: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const [orders, enrollments] = await Promise.all([
    req.payload.count({
      collection: 'orders',
      where: { course: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'enrollments',
      where: { course: { equals: id } },
      overrideAccess: true,
      req,
    }),
  ])
  if (orders.totalDocs > 0 || enrollments.totalDocs > 0) {
    throw new AppError('COURSE_HAS_ENROLLMENTS')
  }
}
