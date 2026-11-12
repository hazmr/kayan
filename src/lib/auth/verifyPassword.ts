import type { PayloadRequest } from 'payload'

/**
 * Checks a password by logging in with it. Wrong tries count toward the account lock.
 * Used before actions that are hard to undo: role changes, deleting users, money records.
 */
export async function passwordMatches(
  email: string,
  password: string,
  req: PayloadRequest,
): Promise<boolean> {
  return req.payload
    .login({ collection: 'users', data: { email, password } })
    .then(() => true)
    .catch(() => false)
}
