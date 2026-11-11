import type { GlobalConfig } from 'payload'

import { isSuperadmin } from '@/access/roles'
import { label } from '@/collections/shared/labels'

export const DEFAULT_OWNER_SHARE_PERCENT = 70

export const PlatformSettings: GlobalConfig = {
  slug: 'platform-settings',
  label: label('Platform settings', 'إعدادات المنصة'),
  access: {
    read: ({ req: { user } }) => isSuperadmin(user),
    update: ({ req: { user } }) => isSuperadmin(user),
  },
  fields: [
    {
      name: 'defaultOwnerSharePercent',
      type: 'number',
      label: label('Default doctor share (%)', 'نسبة الطبيب الافتراضية (%)'),
      required: true,
      defaultValue: DEFAULT_OWNER_SHARE_PERCENT,
      min: 0,
      max: 100,
      admin: {
        step: 1,
        description: label(
          'Copied onto each new course. Changing it does not affect existing courses.',
          'تُنسخ إلى كل دورة جديدة. تغييرها لا يؤثر على الدورات الموجودة.',
        ),
      },
      validate: (value: unknown) =>
        (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100) ||
        'Enter a whole number from 0 to 100.',
    },
  ],
}
