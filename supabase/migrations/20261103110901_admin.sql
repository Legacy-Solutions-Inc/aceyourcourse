CREATE TYPE "public"."denied_reason" AS ENUM('not-staff', 'invite-expired');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('active', 'invited');--> statement-breakpoint
CREATE TABLE "denied_sign_ins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "denied_sign_ins_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"reason" "denied_reason" NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "denied_sign_ins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "record_stamps" (
	"record" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "record_stamps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff" (
	"email" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"status" "staff_status" NOT NULL,
	"role" "staff_role" NOT NULL,
	"name" text,
	"added_at" timestamp with time zone,
	"last_signed_in_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "staff_email_lowercase" CHECK ("staff"."email" = lower("staff"."email")),
	CONSTRAINT "staff_active_or_invited" CHECK (("staff"."status" = 'active' and "staff"."name" is not null and "staff"."added_at" is not null)
        or ("staff"."status" = 'invited' and "staff"."invited_at" is not null and "staff"."expires_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "staff_activity_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone NOT NULL,
	"actor_email" text NOT NULL,
	"actor_name" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
ALTER TABLE "staff_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "denied_sign_ins_email_at_idx" ON "denied_sign_ins" USING btree ("email","at");