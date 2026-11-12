import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// A hand-written migration: Payload cannot describe a CHECK constraint.
//
// The rule: the Admin (role superadmin) is always "id zero", the all-zero UUID. Because ids are
// unique, this also means there can never be more than one Admin, whatever the code does. The
// Admin is created by `pnpm superadmin:create` (src/lib/users/createAdmin.ts).
//
// On a database that already has an Admin with another id this migration stops with an error:
// that Admin must be recreated first (development data only; nothing is live yet).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD CONSTRAINT "users_admin_is_id_zero"
    CHECK ("role" <> 'superadmin' OR "id" = '00000000-0000-0000-0000-000000000000');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" DROP CONSTRAINT "users_admin_is_id_zero";`)
}
