import { APIError } from 'payload'

import { ERROR_CODES, type ErrorCode } from './codes'

/**
 * The only error our own code throws on purpose.
 * The message is the code itself, so nothing dynamic or internal can leak into a response.
 * Extending Payload's APIError means Payload turns it into a response with the right HTTP status.
 */
export class AppError extends APIError<{ code: ErrorCode }> {
  readonly code: ErrorCode

  constructor(code: ErrorCode) {
    // (message, status, data, isPublic): isPublic lets the code reach the client.
    super(code, ERROR_CODES[code], { code }, true)
    this.name = 'AppError'
    this.code = code
  }
}
