import {
  APIError,
  AuthenticationError,
  Forbidden,
  LockedAuth,
  NotFound,
  UnauthorizedError,
  UnverifiedEmail,
  ValidationError,
  type Config,
  type PayloadRequest,
} from 'payload'

import { AppError } from './AppError'
import { ERROR_CODES, type ErrorCode } from './codes'

type RootAfterErrorHook = NonNullable<NonNullable<Config['hooks']>['afterError']>[number]

/**
 * Runs after every failed API request and adds a stable `code` to the response body:
 *
 *   { "errors": [...], "code": "INVALID_CREDENTIALS" }
 *
 * Payload's own errors (wrong password, validation, forbidden) carry translated sentences,
 * which the site cannot map reliably. The code is what the site translates.
 * Payload's `errors` array is left untouched because the admin panel reads it.
 */
export const attachErrorCode: RootAfterErrorHook = ({ error, req, result }) => {
  const code = toErrorCode(error, req)
  return {
    response: { ...result, code },
    // Use the status from our table, so codes.ts stays the truth (Payload reports a
    // duplicate email as 400, our table says 409). Unrecognised errors keep Payload's status.
    status: code === 'INTERNAL_ERROR' ? undefined : ERROR_CODES[code],
  }
}

function toErrorCode(error: Error, req: PayloadRequest): ErrorCode {
  if (error instanceof AppError) return error.code
  if (error instanceof AuthenticationError) return 'INVALID_CREDENTIALS'
  if (error instanceof UnverifiedEmail) return 'EMAIL_NOT_VERIFIED'
  if (error instanceof LockedAuth) return 'ACCOUNT_LOCKED'
  if (error instanceof ValidationError) {
    return isEmailTaken(error, req) ? 'EMAIL_TAKEN' : 'VALIDATION_FAILED'
  }
  if (error instanceof UnauthorizedError) return 'UNAUTHENTICATED'
  if (error instanceof Forbidden) return 'FORBIDDEN'
  if (error instanceof NotFound) return 'NOT_FOUND'
  if (error instanceof APIError) {
    // Payload reports a bad or expired verification/reset token as a plain 403.
    if (error.status === 403 && isTokenRoute(req)) return 'INVALID_TOKEN'
    return codeForStatus(error.status)
  }
  return 'INTERNAL_ERROR'
}

function isEmailTaken(error: ValidationError, req: PayloadRequest): boolean {
  // Compare against the same translation Payload used to build the message,
  // so this works whatever language the request was made in.
  const duplicateMessage = req.t('error:userEmailAlreadyRegistered')
  return error.data.errors.some(
    (fieldError) => fieldError.path === 'email' && fieldError.message === duplicateMessage,
  )
}

function isTokenRoute(req: PayloadRequest): boolean {
  if (!req.url) return false
  const { pathname } = new URL(req.url)
  return pathname.endsWith('/users/reset-password') || pathname.includes('/users/verify/')
}

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_FAILED'
    case 401:
      return 'UNAUTHENTICATED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 429:
      return 'TOO_MANY_REQUESTS'
    default:
      return 'INTERNAL_ERROR'
  }
}
