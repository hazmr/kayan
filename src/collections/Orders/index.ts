import type { CollectionConfig, FieldAccess } from 'payload'

import { closed, readOwnOrStaff } from '@/access/orders'
import { isStaff } from '@/access/roles'
import { ORDER_STATUSES, PAYMENT_METHODS } from '@/lib/orders/transitions'

import { collectionLabels, label } from '../shared/labels'
import { orderEndpoints } from './endpoints'

const staffOnlyField: FieldAccess = ({ req: { user } }) => isStaff(user)

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: collectionLabels(['Order', 'طلب'], ['Orders', 'الطلبات']),
  admin: { useAsTitle: 'reference', defaultColumns: ['reference', 'status', 'amount'] },
  access: {
    read: readOwnOrStaff,
    // Orders change only through the functions in src/lib/orders, which enforce every rule.
    create: closed,
    update: closed,
    delete: closed,
  },
  endpoints: orderEndpoints,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true, index: true },
    {
      // While the order is pending this follows the course price. It freezes when the first
      // receipt is uploaded (amountFrozenAt is set), and never changes after that.
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      label: label('Amount (piasters)', 'المبلغ (بالقرش)'),
    },
    {
      // The Admin's share of this order, frozen with the amount. The academy keeps the rest.
      name: 'adminAmount',
      type: 'number',
      min: 0,
      access: { read: staffOnlyField },
      label: label("Admin's share (piasters)", 'نصيب مسؤول النظام (بالقرش)'),
    },
    { name: 'amountFrozenAt', type: 'date' },
    // Empty for free courses.
    { name: 'provider', type: 'select', options: ['manual', 'paymob'] },
    { name: 'method', type: 'select', options: [...PAYMENT_METHODS] },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [...ORDER_STATUSES],
    },
    // The short code the student writes in the transfer note, such as KY-7K3M9Q.
    { name: 'reference', type: 'text', required: true, unique: true, index: true },
    { name: 'providerRef', type: 'text' },
    { name: 'paidAt', type: 'date' },
    {
      name: 'refundStatus',
      type: 'select',
      required: true,
      defaultValue: 'none',
      index: true,
      options: ['none', 'requested', 'declined'],
    },
    { name: 'refundReason', type: 'textarea' },
    { name: 'refundTo', type: 'text' },
    { name: 'refundRequestedAt', type: 'date' },
    { name: 'refundDecisionNote', type: 'textarea' },
    { name: 'refundedAt', type: 'date' },
    {
      name: 'refundedBy',
      type: 'relationship',
      relationTo: 'users',
      access: { read: staffOnlyField },
    },
  ],
}
