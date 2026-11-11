import { sql } from '@payloadcms/db-postgres/drizzle'
import type { PayloadRequest } from 'payload'

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }

interface DrizzleAdapter {
  drizzle: Executor
  sessions: Record<string, { db: Executor }>
}

/** Only these tables may be locked, so a table name can never come from outside. */
const LOCKABLE = { orders: sql`orders`, users: sql`users` } as const

/**
 * Locks one row until the current transaction ends (SELECT ... FOR UPDATE).
 * Anyone else trying to lock the same row waits here, then sees what we changed.
 *
 * Why: two managers clicking Approve at the same moment would otherwise both see
 * "awaiting review" and both proceed. With the lock, the second waits, then sees "paid"
 * and stops. Must be called inside withTransaction.
 */
export async function lockRow(
  req: PayloadRequest,
  table: keyof typeof LOCKABLE,
  id: string,
): Promise<void> {
  const adapter = req.payload.db as unknown as DrizzleAdapter
  const transactionId = req.transactionID ? await req.transactionID : undefined
  const session = transactionId === undefined ? undefined : adapter.sessions[String(transactionId)]
  if (!session) {
    // A lock outside a transaction would be released at once and protect nothing.
    throw new Error('lockRow must be called inside withTransaction')
  }
  await session.db.execute(sql`select id from ${LOCKABLE[table]} where id = ${id} for update`)
}
