CREATE TYPE "public"."privacy_request_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_type" AS ENUM('data-copy', 'deletion');--> statement-breakpoint
CREATE TABLE "privacy_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"type" "privacy_request_type" NOT NULL,
	"status" "privacy_request_status" NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"due_on" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "privacy_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "privacy_requests_user_id_idx" ON "privacy_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_requests_one_open_per_type_idx" ON "privacy_requests" USING btree ("user_id","type") WHERE "privacy_requests"."status" = 'open';