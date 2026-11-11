import type { CollectionConfig, FieldAccess } from 'payload'

import { editCourseContent, readCourseContent } from '@/access/courses'
import { hasRole, isStaff, isSuperadmin } from '@/access/roles'
import { COURSE_STATUSES } from '@/lib/courses/transitions'
import type { Course } from '@/payload-types'

import { collectionLabels, label } from '../shared/labels'
import { relationId } from '../shared/relationId'
import { requireArabic } from '../shared/requireArabic'
import { slugField } from '../shared/slug'
import { courseEndpoints } from './endpoints'
import {
  deleteCourseContent,
  fillSlug,
  refuseDeleteWhenSold,
  requireDoctorOwner,
  setCreationDefaults,
} from './hooks'

const superadminField: FieldAccess = ({ req: { user } }) => isSuperadmin(user)

const staffField: FieldAccess = ({ req: { user } }) => isStaff(user)

/** Business details (share percent, review note) are for staff and the course's own doctor. */
const staffOrOwnerField: FieldAccess<Course> = ({ req: { user }, doc }) =>
  isStaff(user) || (Boolean(user) && relationId(doc?.owner) === user?.id)

/** A doctor sets the price only while the course is a draft. Staff can change it any time. */
const priceUpdate: FieldAccess<Course> = ({ req: { user }, doc }) =>
  isStaff(user) || doc?.status === 'draft'

const never: FieldAccess = () => false

const STATUS_LABELS: Record<Course['status'], { en: string; ar: string }> = {
  draft: label('Draft', 'مسودة'),
  in_review: label('In review', 'قيد المراجعة'),
  published: label('Published', 'منشورة'),
  archived: label('Archived', 'مؤرشفة'),
}

export const Courses: CollectionConfig = {
  slug: 'courses',
  labels: collectionLabels(['Course', 'دورة'], ['Courses', 'الدورات']),
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'owner', 'price', 'updatedAt'],
    listSearchableFields: ['title', 'slug'],
  },
  access: {
    read: readCourseContent(''),
    // Staff create a course on behalf of a doctor and must pick that doctor as the owner.
    create: ({ req: { user } }) => hasRole(user, 'superadmin', 'manager', 'admin'),
    update: editCourseContent(''),
    delete: ({ req: { user } }) => isSuperadmin(user),
  },
  hooks: {
    beforeValidate: [requireArabic(['title', 'description']), fillSlug, setCreationDefaults],
    beforeChange: [requireDoctorOwner],
    beforeDelete: [refuseDeleteWhenSold, deleteCourseContent],
  },
  endpoints: courseEndpoints,
  fields: [
    {
      name: 'title',
      type: 'text',
      label: label('Title', 'العنوان'),
      // Arabic is required by the requireArabic hook. Not `required` here: Payload would then
      // demand a value in every language, and English is optional.
      localized: true,
      maxLength: 160,
    },
    {
      name: 'description',
      type: 'textarea',
      label: label('Description', 'الوصف'),
      // Arabic is required by the requireArabic hook. Not `required` here: Payload would then
      // demand a value in every language, and English is optional.
      localized: true,
      maxLength: 5000,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: label('Category', 'التصنيف'),
      index: true,
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      label: label('Thumbnail', 'صورة الدورة'),
    },
    {
      name: 'price',
      type: 'number',
      // Stored in piasters. The dashboard converts to and from whole pounds.
      label: label('Price (piasters)', 'السعر (بالقرش)'),
      required: true,
      defaultValue: 0,
      min: 0,
      access: { update: priceUpdate },
      validate: (value: unknown) =>
        (typeof value === 'number' && Number.isInteger(value) && value >= 0) ||
        'Enter a whole number, 0 or more.',
    },
    {
      name: 'modules',
      type: 'join',
      collection: 'modules',
      on: 'course',
      label: label('Modules', 'الوحدات'),
      defaultSort: 'position',
    },
    {
      name: 'status',
      type: 'select',
      label: label('Status', 'الحالة'),
      required: true,
      defaultValue: 'draft',
      index: true,
      options: COURSE_STATUSES.map((status) => ({ label: STATUS_LABELS[status], value: status })),
      // Nobody edits this by hand. The buttons call endpoints that run the review rules.
      access: { create: never, update: never },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'reviewNote',
      type: 'textarea',
      label: label('Review note', 'ملاحظة المراجعة'),
      access: { read: staffOrOwnerField, create: never, update: never },
      admin: {
        position: 'sidebar',
        readOnly: true,
        condition: (data) => Boolean(data?.reviewNote),
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      label: label('Doctor', 'الطبيب'),
      required: true,
      index: true,
      filterOptions: { role: { equals: 'admin' } },
      // Staff pick the doctor when creating a course. Doctors never choose: a hook sets it to
      // themselves. After creation only the superadmin can move a course to another doctor.
      access: { create: staffField, update: superadminField },
      admin: { position: 'sidebar' },
    },
    {
      name: 'ownerSharePercent',
      type: 'number',
      label: label('Doctor share (%)', 'نسبة الطبيب (%)'),
      min: 0,
      max: 100,
      access: { read: staffOrOwnerField, create: superadminField, update: superadminField },
      admin: { position: 'sidebar', step: 1 },
      validate: (value: unknown) =>
        value === undefined ||
        value === null ||
        (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100) ||
        'Enter a whole number from 0 to 100.',
    },
    slugField,
  ],
}
