import type { CollectionConfig } from 'payload'

import { closed, readOwnEnrollmentOrStaff } from '@/access/orders'

import { collectionLabels } from '../shared/labels'

/**
 * Who may watch what. Access to a course is decided here and nowhere else: never by reading
 * orders. (A future subscription adds one more branch to the access check.)
 */
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  labels: collectionLabels(['Enrollment', 'اشتراك'], ['Enrollments', 'الاشتراكات']),
  access: {
    read: readOwnEnrollmentOrStaff,
    create: closed,
    update: closed,
    delete: closed,
  },
  // One enrollment per student per course. A refund revokes it and a new purchase reactivates it.
  indexes: [{ fields: ['user', 'course'], unique: true }],
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true, index: true },
    // The order that most recently activated this enrollment.
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: ['active', 'revoked'],
    },
  ],
}
