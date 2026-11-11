import type { CollectionConfig } from 'payload'

/**
 * A request to make someone an owner, waiting for the requesting owner to confirm it from the
 * link in their email. Never reachable through the API: only src/lib/users/ownerPromotion.ts
 * reads and writes it.
 */
export const OwnerPromotions: CollectionConfig = {
  slug: 'owner-promotions',
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'target', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'requestedBy', type: 'relationship', relationTo: 'users', required: true },
    // Only a hash of the emailed token is stored, so a database leak cannot confirm anything.
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'confirmedAt', type: 'date' },
  ],
}
