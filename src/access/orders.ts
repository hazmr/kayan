import type { Access } from 'payload'

import { isStaff } from './roles'

/** Never writable through the API. Only our own functions in src/lib change these records. */
export const closed: Access = () => false

/** Staff read every order; a student reads their own. Doctors read sales through earnings (M6). */
export const readOwnOrStaff: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isStaff(user)) return true
  return { user: { equals: user.id } }
}

/** Same rule for enrollments, which also carry a `user` field. */
export const readOwnEnrollmentOrStaff = readOwnOrStaff

/** A receipt belongs to an order, so a student reads the receipts of their own orders. */
export const readOwnReceiptOrStaff: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isStaff(user)) return true
  return { 'order.user': { equals: user.id } }
}
