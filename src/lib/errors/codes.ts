// Every error the API can return, with its HTTP status. This is the single source of truth.
// The site translates each code in messages/ar.json and messages/en.json under "errors".
// This file has no imports on purpose: both server and browser code can use it.
// New codes are added here as each milestone needs them.

export const ERROR_CODES = {
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  INVALID_TOKEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  PASSWORD_TOO_SHORT: 400,
  EMAIL_TAKEN: 409,
  LAST_SUPERADMIN: 409,
  WRONG_PASSWORD: 403,
  SELF_CHANGE_NOT_ALLOWED: 409,
  CATEGORY_TOO_DEEP: 400,
  CATEGORY_IN_USE: 409,
  COURSE_OWNER_INVALID: 400,
  COURSE_INCOMPLETE: 400,
  COURSE_INVALID_STATE: 409,
  REVIEW_NOTE_REQUIRED: 400,
  ALREADY_ENROLLED: 409,
  ONLY_STUDENTS_CAN_BUY: 403,
  COURSE_NOT_PURCHASABLE: 409,
  COURSE_HAS_ENROLLMENTS: 409,
  USER_HAS_RECORDS: 409,
  ORDER_INVALID_STATE: 409,
  ORDER_PRICE_CHANGED: 409,
  PAYMENT_METHOD_UNAVAILABLE: 409,
  RECEIPT_INVALID_TYPE: 400,
  RECEIPT_TOO_LARGE: 413,
  REFUND_NOT_ALLOWED: 409,
  REFUND_ALREADY_REQUESTED: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value)
}

export const MIN_PASSWORD_LENGTH = 8
