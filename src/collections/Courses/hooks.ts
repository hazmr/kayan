import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
} from 'payload'

import { isStaff, roleOf } from '@/access/roles'
import { DEFAULT_OWNER_SHARE_PERCENT } from '@/globals/PlatformSettings'
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
 * New courses always start as a draft owned by their creator, with the platform's default share.
 * This runs before validation, so the required `owner` field is filled in for doctors.
 */
export const setCreationDefaults: CollectionBeforeValidateHook<Course> = async ({
  data,
  operation,
  req,
}) => {
  if (!data || operation !== 'create') return data

  data.status = 'draft'
  data.reviewNote = null

  // Only staff may create a course for someone else. Everyone else owns what they create.
  if (req.user && !(isStaff(req.user) && data.owner)) {
    data.owner = req.user.id
  }

  if (data.ownerSharePercent === undefined || data.ownerSharePercent === null) {
    const settings = await req.payload.findGlobal({
      slug: 'platform-settings',
      overrideAccess: true,
      req,
    })
    data.ownerSharePercent = settings.defaultOwnerSharePercent ?? DEFAULT_OWNER_SHARE_PERCENT
  }
  return data
}

/** Earnings go to the owner, so the owner must be a doctor account. */
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
