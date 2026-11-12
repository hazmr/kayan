import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payouts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"owner_id" uuid NOT NULL,
  	"amount" numeric NOT NULL,
  	"paid_at" timestamp(3) with time zone NOT NULL,
  	"paid_by_id" uuid NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payouts_id" uuid;
  ALTER TABLE "payouts" ADD CONSTRAINT "payouts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payouts" ADD CONSTRAINT "payouts_paid_by_id_users_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payouts_owner_idx" ON "payouts" USING btree ("owner_id");
  CREATE INDEX "payouts_paid_at_idx" ON "payouts" USING btree ("paid_at");
  CREATE INDEX "payouts_paid_by_idx" ON "payouts" USING btree ("paid_by_id");
  CREATE INDEX "payouts_updated_at_idx" ON "payouts" USING btree ("updated_at");
  CREATE INDEX "payouts_created_at_idx" ON "payouts" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payouts_fk" FOREIGN KEY ("payouts_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_payouts_id_idx" ON "payload_locked_documents_rels" USING btree ("payouts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payouts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payouts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payouts_fk";
  
  DROP INDEX "payload_locked_documents_rels_payouts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payouts_id";`)
}
