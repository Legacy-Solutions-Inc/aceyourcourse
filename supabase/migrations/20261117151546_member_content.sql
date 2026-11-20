CREATE TYPE "public"."content_visibility" AS ENUM('hidden', 'visible');--> statement-breakpoint
CREATE TYPE "public"."reviewer_pdf_status" AS ENUM('processing', 'draft', 'published', 'unpublished', 'failed');--> statement-breakpoint
CREATE TABLE "access_pass_grants" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "access_pass_grants_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"exam_code" text NOT NULL,
	"days" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"granted_by_email" text NOT NULL,
	"granted_by_name" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "access_pass_grants_days_range" CHECK ("access_pass_grants"."days" between 1 and 365),
	CONSTRAINT "access_pass_grants_ends_after_start" CHECK ("access_pass_grants"."ends_at" > "access_pass_grants"."starts_at"),
	CONSTRAINT "access_pass_grants_reason_present" CHECK (btrim("access_pass_grants"."reason") <> '')
);
--> statement-breakpoint
ALTER TABLE "access_pass_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "access_passes" (
	"user_id" uuid NOT NULL,
	"exam_code" text NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	CONSTRAINT "access_passes_user_id_exam_code_pk" PRIMARY KEY("user_id","exam_code")
);
--> statement-breakpoint
ALTER TABLE "access_passes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic_id" uuid NOT NULL,
	"visibility" "content_visibility" DEFAULT 'hidden' NOT NULL,
	"free_preview" boolean DEFAULT false NOT NULL,
	CONSTRAINT "decks_topic_id_key" UNIQUE("topic_id")
);
--> statement-breakpoint
ALTER TABLE "decks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic_id" uuid NOT NULL,
	"visibility" "content_visibility" DEFAULT 'hidden' NOT NULL,
	"free_preview" boolean DEFAULT false NOT NULL,
	CONSTRAINT "quizzes_topic_id_key" UNIQUE("topic_id")
);
--> statement-breakpoint
ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviewer_pdfs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic_id" uuid,
	"status" "reviewer_pdf_status" DEFAULT 'processing' NOT NULL,
	"free_preview" boolean DEFAULT false NOT NULL,
	CONSTRAINT "reviewer_pdfs_topic_id_key" UNIQUE("topic_id"),
	CONSTRAINT "reviewer_pdfs_published_has_topic" CHECK ("reviewer_pdfs"."status" <> 'published' or "reviewer_pdfs"."topic_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exam_code" text NOT NULL,
	"subject_code" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "topics_name_length" CHECK (char_length("topics"."name") between 1 and 120),
	CONSTRAINT "topics_name_trimmed" CHECK ("topics"."name" = btrim("topics"."name")),
	CONSTRAINT "topics_position_positive" CHECK ("topics"."position" > 0)
);
--> statement-breakpoint
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "access_pass_grants" ADD CONSTRAINT "access_pass_grants_pass_fk" FOREIGN KEY ("user_id","exam_code") REFERENCES "public"."access_passes"("user_id","exam_code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_pdfs" ADD CONSTRAINT "reviewer_pdfs_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_fk" FOREIGN KEY ("exam_code","subject_code") REFERENCES "public"."subjects"("exam_code","code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "access_pass_grants_user_id_exam_code_seq_idx" ON "access_pass_grants" USING btree ("user_id","exam_code","seq");--> statement-breakpoint
CREATE INDEX "access_passes_exam_code_idx" ON "access_passes" USING btree ("exam_code");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_subject_name_key" ON "topics" USING btree ("exam_code","subject_code",lower("name"));