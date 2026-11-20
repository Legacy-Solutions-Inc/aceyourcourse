CREATE TYPE "public"."reviewer_pdf_failure" AS ENUM('password', 'corrupt', 'too-big', 'too-many-restarts');--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD COLUMN "uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD COLUMN "pages_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD COLUMN "heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD COLUMN "restarts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD COLUMN "failure" "reviewer_pdf_failure";--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_file_whole" CHECK (("reviewer_pdfs"."file_name" is null) = ("reviewer_pdfs"."uploaded_at" is null) and ("reviewer_pdfs"."file_size" is null) = ("reviewer_pdfs"."uploaded_at" is null));--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_file_name_length" CHECK ("reviewer_pdfs"."file_name" is null or char_length("reviewer_pdfs"."file_name") between 1 and 200);--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_file_size_positive" CHECK ("reviewer_pdfs"."file_size" is null or "reviewer_pdfs"."file_size" > 0);--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_page_count_positive" CHECK ("reviewer_pdfs"."page_count" is null or "reviewer_pdfs"."page_count" > 0);--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_pages_done_range" CHECK ("reviewer_pdfs"."pages_done" between 0 and coalesce("reviewer_pdfs"."page_count", 0));--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_draft_has_every_page" CHECK ("reviewer_pdfs"."status" <> 'draft' or "reviewer_pdfs"."page_count" is null or "reviewer_pdfs"."pages_done" = "reviewer_pdfs"."page_count");--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_restarts_positive" CHECK ("reviewer_pdfs"."restarts" >= 0);--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_failed_has_failure" CHECK (("reviewer_pdfs"."status" = 'failed') = ("reviewer_pdfs"."failure" is not null));