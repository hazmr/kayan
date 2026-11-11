import { AppError } from '@/lib/errors/AppError'

export const ORDER_STATUSES = [
  'pending',
  'awaiting_review',
  'paid',
  'rejected',
  'refunded',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_METHODS = ['instapay', 'vodafone_cash'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * The order status diagram from docs/02-design.md as data. Every status change in the code
 * goes through assertTransition, so the diagram and the behaviour cannot drift apart.
 * 'pending' -> 'paid' is only for free courses (amount 0); fulfillOrder checks that.
 */
export const ORDER_TRANSITIONS = {
  pending: ['awaiting_review', 'paid', 'cancelled'],
  awaiting_review: ['paid', 'rejected'],
  rejected: ['awaiting_review', 'cancelled'],
  paid: ['refunded'],
  refunded: [],
  cancelled: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>

/** A student can have only one order per course in one of these statuses. */
export const OPEN_ORDER_STATUSES = ['pending', 'awaiting_review', 'rejected'] as const

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed: readonly OrderStatus[] = ORDER_TRANSITIONS[from]
  if (!allowed.includes(to)) throw new AppError('ORDER_INVALID_STATE')
}
