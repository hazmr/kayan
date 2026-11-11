import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// A hand-written migration: Payload cannot describe an index that applies to only some rows.
//
// The rule: a student has at most ONE open order per course. "Open" means an order that is
// still going somewhere: pending, awaiting_review, or rejected (the student may upload a new
// receipt). Paid, refunded, and cancelled orders are finished, so a student can have many of those.
//
// The code already checks this (startOrder). This index is the safety net underneath: even a
// bug, or two requests landing at the same instant, cannot create a second open order.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX "orders_one_open_per_user_course"
    ON "orders" ("user_id", "course_id")
    WHERE "status" IN ('pending', 'awaiting_review', 'rejected');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX "orders_one_open_per_user_course";`)
}
