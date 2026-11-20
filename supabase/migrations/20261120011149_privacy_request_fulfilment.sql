ALTER TABLE "privacy_requests" ADD COLUMN "done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD COLUMN "done_by_email" text;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD COLUMN "done_by_name" text;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD COLUMN "deleted_user_id" uuid;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_done_when_and_by_whom" CHECK (("privacy_requests"."status" = 'open' and "privacy_requests"."done_at" is null and "privacy_requests"."done_by_email" is null and "privacy_requests"."done_by_name" is null)
        or ("privacy_requests"."status" = 'done' and "privacy_requests"."done_at" is not null and "privacy_requests"."done_by_email" is not null and "privacy_requests"."done_by_name" is not null));