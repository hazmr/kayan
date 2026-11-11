import type { GlobalConfig } from 'payload'

import { isStaff, isSuperadmin } from '@/access/roles'
import { label } from '@/collections/shared/labels'

/**
 * Where students send their money. Only the owner can change it: a wrong value here sends
 * every student's payment to the wrong account.
 */
export const PaymentSettings: GlobalConfig = {
  slug: 'payment-settings',
  label: label('Payment settings', 'إعدادات الدفع'),
  access: {
    read: ({ req: { user } }) => isStaff(user),
    update: ({ req: { user } }) => isSuperadmin(user),
  },
  fields: [
    {
      name: 'instapayAddress',
      type: 'text',
      maxLength: 120,
      label: label('InstaPay address', 'عنوان إنستاباي'),
    },
    {
      name: 'vodafoneCashNumber',
      type: 'text',
      maxLength: 40,
      label: label('Vodafone Cash number', 'رقم فودافون كاش'),
    },
  ],
}
