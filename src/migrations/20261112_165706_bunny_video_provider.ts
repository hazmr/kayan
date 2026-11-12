import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Lessons can be hosted on Bunny Stream (signed links, DRM) as well as YouTube.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_lessons_video_provider" ADD VALUE 'bunny';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "video_provider" SET DATA TYPE text;
  ALTER TABLE "lessons" ALTER COLUMN "video_provider" SET DEFAULT 'youtube'::text;
  DROP TYPE "public"."enum_lessons_video_provider";
  CREATE TYPE "public"."enum_lessons_video_provider" AS ENUM('youtube');
  ALTER TABLE "lessons" ALTER COLUMN "video_provider" SET DEFAULT 'youtube'::"public"."enum_lessons_video_provider";
  ALTER TABLE "lessons" ALTER COLUMN "video_provider" SET DATA TYPE "public"."enum_lessons_video_provider" USING "video_provider"::"public"."enum_lessons_video_provider";`)
}
