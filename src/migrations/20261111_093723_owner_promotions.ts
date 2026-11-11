import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "owner_promotions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"target_id" uuid NOT NULL,
  	"requested_by_id" uuid NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"confirmed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "owner_promotions_id" uuid;
  ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "owner_promotions_target_idx" ON "owner_promotions" USING btree ("target_id");
  CREATE INDEX "owner_promotions_requested_by_idx" ON "owner_promotions" USING btree ("requested_by_id");
  CREATE UNIQUE INDEX "owner_promotions_token_hash_idx" ON "owner_promotions" USING btree ("token_hash");
  CREATE INDEX "owner_promotions_updated_at_idx" ON "owner_promotions" USING btree ("updated_at");
  CREATE INDEX "owner_promotions_created_at_idx" ON "owner_promotions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_owner_promotions_fk" FOREIGN KEY ("owner_promotions_id") REFERENCES "public"."owner_promotions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_owner_promotions_id_idx" ON "payload_locked_documents_rels" USING btree ("owner_promotions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "owner_promotions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "owner_promotions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_owner_promotions_fk";
  
  DROP INDEX "payload_locked_documents_rels_owner_promotions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "owner_promotions_id";`)
}
