import type { CollectionConfig } from 'payload'

import { closed } from '@/access/orders'
import { isStaff } from '@/access/roles'

import { collectionLabels, label } from '../shared/labels'
import { adminPaymentEndpoints } from './endpoints'

/**
 * A record that the academy paid the Admin part of their share. The system never moves money:
 * this is only the note written down AFTER the transfer. The Admin and instructors read them all
 * (everyone sees the same balance). Writes go through src/lib/earnings/adminPayments.ts.
 */
export const AdminPayments: CollectionConfig = {
  slug: 'admin-payments',
  labels: collectionLabels(
    ['Payment to the Admin', 'دفعة لمسؤول النظام'],
    ['Payments to the Admin', 'دفعات مسؤول النظام'],
  ),
  access: {
    read: ({ req: { user } }) => isStaff(user),
    create: closed,
    update: closed,
    delete: closed,
  },
  endpoints: adminPaymentEndpoints,
  fields: [
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 1,
      label: label('Amount (piasters)', 'المبلغ (بالقرش)'),
    },
    // The day the money was sent, which may differ from the day it was recorded.
    { name: 'paidAt', type: 'date', required: true, index: true },
    { name: 'recordedBy', type: 'relationship', relationTo: 'users', required: true },
    { name: 'note', type: 'textarea', maxLength: 500 },
  ],
}
