import type { GlobalConfig } from 'payload'

import { isStaff, isSuperadmin } from '@/access/roles'
import { label } from '@/collections/shared/labels'

/** The Admin's share starts at 0% until the agreed number is entered. */
export const DEFAULT_ADMIN_SHARE_PERCENT = 0

/**
 * The academy's money rule: the Admin earns this percent of every paid sale; the academy keeps
 * the rest. Instructors can read it (they pay it); only the Admin can change it, and a change
 * applies to sales from then on (each order freezes its own share when the student pays).
 */
export const PlatformSettings: GlobalConfig = {
  slug: 'platform-settings',
  label: label('Platform settings', 'إعدادات المنصة'),
  access: {
    read: ({ req: { user } }) => isStaff(user),
    update: ({ req: { user } }) => isSuperadmin(user),
  },
  fields: [
    {
      name: 'adminSharePercent',
      type: 'number',
      label: label("Admin's share of each sale (%)", 'نسبة مسؤول النظام من كل عملية بيع (%)'),
      required: true,
      defaultValue: DEFAULT_ADMIN_SHARE_PERCENT,
      min: 0,
      max: 100,
      admin: { step: 1 },
      validate: (value: unknown) =>
        (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100) ||
        'Enter a whole number from 0 to 100.',
    },
  ],
}
