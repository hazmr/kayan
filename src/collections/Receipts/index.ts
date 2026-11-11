import type { CollectionConfig } from 'payload'

import { closed, readOwnReceiptOrStaff } from '@/access/orders'

import { collectionLabels } from '../shared/labels'

// Payment screenshots. Private: every file is served through Payload, which runs the read rule
// below first. Never set `disablePayloadAccessControl` on this collection when moving to R2.
export const Receipts: CollectionConfig = {
  slug: 'receipts',
  labels: collectionLabels(['Receipt', 'إيصال'], ['Receipts', 'الإيصالات']),
  access: {
    read: readOwnReceiptOrStaff,
    create: closed,
    update: closed,
    delete: closed,
  },
  upload: {
    // Kept outside /media, which is public. Development only: production uses R2.
    staticDir: 'receipts',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    { name: 'senderNumber', type: 'text', required: true, maxLength: 40 },
    // Empty until a manager reviews it. Each receipt gets its own decision, because one order
    // can have several (a rejected receipt is followed by a new one).
    { name: 'decision', type: 'select', options: ['approved', 'rejected'] },
    { name: 'reviewNote', type: 'textarea' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'users' },
    { name: 'reviewedAt', type: 'date' },
  ],
}
