import type { CollectionConfig } from 'payload'

import { closed } from '@/access/orders'
import { readOwnPayoutOrStaff } from '@/access/payouts'

import { collectionLabels, label } from '../shared/labels'
import { payoutEndpoints } from './endpoints'

/**
 * A record that the owner sent money to a doctor. The system never moves money: this is only
 * the note the owner leaves AFTER transferring it by hand. Writes go through the functions in
 * src/lib/earnings/payouts.ts, never the generic API.
 */
export const Payouts: CollectionConfig = {
  slug: 'payouts',
  labels: collectionLabels(['Payout', 'دفعة'], ['Payouts', 'الدفعات']),
  access: {
    read: readOwnPayoutOrStaff,
    create: closed,
    update: closed,
    delete: closed,
  },
  endpoints: payoutEndpoints,
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 1,
      label: label('Amount (piasters)', 'المبلغ (بالقرش)'),
    },
    // The day the money was sent, which may differ from the day it was recorded.
    { name: 'paidAt', type: 'date', required: true, index: true },
    { name: 'paidBy', type: 'relationship', relationTo: 'users', required: true },
    { name: 'note', type: 'textarea', maxLength: 500 },
  ],
}
