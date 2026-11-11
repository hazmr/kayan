import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "courses_locales" ALTER COLUMN "description" DROP NOT NULL;
  ALTER TABLE "modules_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "lessons_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "categories_locales" ALTER COLUMN "title" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "courses_locales" ALTER COLUMN "description" SET NOT NULL;
  ALTER TABLE "modules_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "lessons_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "categories_locales" ALTER COLUMN "title" SET NOT NULL;`)
}
