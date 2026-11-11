import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_provider" AS ENUM('manual', 'paymob');
  CREATE TYPE "public"."enum_orders_method" AS ENUM('instapay', 'vodafone_cash');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'awaiting_review', 'paid', 'rejected', 'refunded', 'cancelled');
  CREATE TYPE "public"."enum_orders_refund_status" AS ENUM('none', 'requested', 'declined');
  CREATE TYPE "public"."enum_receipts_decision" AS ENUM('approved', 'rejected');
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('active', 'revoked');
  CREATE TABLE "orders" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"course_id" uuid NOT NULL,
  	"owner_id" uuid,
  	"amount" numeric NOT NULL,
  	"owner_amount" numeric,
  	"amount_frozen_at" timestamp(3) with time zone,
  	"provider" "enum_orders_provider",
  	"method" "enum_orders_method",
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"reference" varchar NOT NULL,
  	"provider_ref" varchar,
  	"paid_at" timestamp(3) with time zone,
  	"refund_status" "enum_orders_refund_status" DEFAULT 'none' NOT NULL,
  	"refund_reason" varchar,
  	"refund_to" varchar,
  	"refund_requested_at" timestamp(3) with time zone,
  	"refund_decision_note" varchar,
  	"refunded_at" timestamp(3) with time zone,
  	"refunded_by_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "receipts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"order_id" uuid NOT NULL,
  	"sender_number" varchar NOT NULL,
  	"decision" "enum_receipts_decision",
  	"review_note" varchar,
  	"reviewed_by_id" uuid,
  	"reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "enrollments" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"course_id" uuid NOT NULL,
  	"order_id" uuid NOT NULL,
  	"status" "enum_enrollments_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payment_settings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"instapay_address" varchar,
  	"vodafone_cash_number" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "receipts_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enrollments_id" uuid;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_by_id_users_id_fk" FOREIGN KEY ("refunded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "receipts" ADD CONSTRAINT "receipts_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");
  CREATE INDEX "orders_course_idx" ON "orders" USING btree ("course_id");
  CREATE INDEX "orders_owner_idx" ON "orders" USING btree ("owner_id");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE UNIQUE INDEX "orders_reference_idx" ON "orders" USING btree ("reference");
  CREATE INDEX "orders_refund_status_idx" ON "orders" USING btree ("refund_status");
  CREATE INDEX "orders_refunded_by_idx" ON "orders" USING btree ("refunded_by_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "receipts_order_idx" ON "receipts" USING btree ("order_id");
  CREATE INDEX "receipts_reviewed_by_idx" ON "receipts" USING btree ("reviewed_by_id");
  CREATE INDEX "receipts_updated_at_idx" ON "receipts" USING btree ("updated_at");
  CREATE INDEX "receipts_created_at_idx" ON "receipts" USING btree ("created_at");
  CREATE UNIQUE INDEX "receipts_filename_idx" ON "receipts" USING btree ("filename");
  CREATE INDEX "enrollments_user_idx" ON "enrollments" USING btree ("user_id");
  CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");
  CREATE INDEX "enrollments_order_idx" ON "enrollments" USING btree ("order_id");
  CREATE INDEX "enrollments_status_idx" ON "enrollments" USING btree ("status");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_course_idx" ON "enrollments" USING btree ("user_id","course_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_receipts_fk" FOREIGN KEY ("receipts_id") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_receipts_id_idx" ON "payload_locked_documents_rels" USING btree ("receipts_id");
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("enrollments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "receipts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "enrollments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payment_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "receipts" CASCADE;
  DROP TABLE "enrollments" CASCADE;
  DROP TABLE "payment_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_receipts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_enrollments_fk";
  
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  DROP INDEX "payload_locked_documents_rels_receipts_id_idx";
  DROP INDEX "payload_locked_documents_rels_enrollments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "receipts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "enrollments_id";
  DROP TYPE "public"."enum_orders_provider";
  DROP TYPE "public"."enum_orders_method";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_refund_status";
  DROP TYPE "public"."enum_receipts_decision";
  DROP TYPE "public"."enum_enrollments_status";`)
}
