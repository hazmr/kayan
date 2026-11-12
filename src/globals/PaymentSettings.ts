import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { isStaff } from '@/access/roles'
import { label } from '@/collections/shared/labels'
import { sendPaymentDetailsChangedEmail } from '@/lib/email/adminPaymentEmails'

/**
 * Any change here is emailed to the Admin and every instructor, so nobody (the Admin included)
 * can quietly send students' money to a different account.
 */
const announceChange: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const before = {
    instapay: previousDoc?.instapayAddress ?? '',
    vodafone: previousDoc?.vodafoneCashNumber ?? '',
  }
  const after = { instapay: doc.instapayAddress ?? '', vodafone: doc.vodafoneCashNumber ?? '' }
  if (before.instapay === after.instapay && before.vodafone === after.vodafone) return doc
  await sendPaymentDetailsChangedEmail(req, {
    by: req.user && 'name' in req.user ? String(req.user.name) : 'The system',
    before,
    after,
  })
  return doc
}

/**
 * Where students send their money: the academy's own InstaPay and Vodafone Cash. The Admin and
 * instructors can change it (it is the academy's account); every change is announced by email.
 */
export const PaymentSettings: GlobalConfig = {
  slug: 'payment-settings',
  label: label('Payment settings', 'إعدادات الدفع'),
  access: {
    read: ({ req: { user } }) => isStaff(user),
    update: ({ req: { user } }) => isStaff(user),
  },
  hooks: { afterChange: [announceChange] },
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
