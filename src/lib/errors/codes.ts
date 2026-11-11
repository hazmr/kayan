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
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value)
}

export const MIN_PASSWORD_LENGTH = 8
