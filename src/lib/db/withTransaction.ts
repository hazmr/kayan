import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'

/**
 * Runs `work` as one all-or-nothing database transaction: if anything throws, every change
 * made through `req` inside it is undone.
 *
 * If a transaction is already open on this request (a bigger operation is running us as one
 * step), this joins it and leaves committing to the outer caller.
 *
 * Why this exists: approving a payment changes the order AND the enrollment. Doing half of
 * that would be worse than doing none of it.
 */
export async function withTransaction<T>(req: PayloadRequest, work: () => Promise<T>): Promise<T> {
  const startedHere = await initTransaction(req)
  try {
    const result = await work()
    if (startedHere) await commitTransaction(req)
    return result
  } catch (error) {
    if (startedHere) await killTransaction(req)
    throw error
  }
}
