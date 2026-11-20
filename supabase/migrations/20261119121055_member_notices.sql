CREATE TYPE "public"."member_notice_kind" AS ENUM('granted', 'extended', 'ended');--> statement-breakpoint
CREATE TABLE "member_notices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "member_notices_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"exam_code" text NOT NULL,
	"kind" "member_notice_kind" NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "member_notices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_notices" ADD CONSTRAINT "member_notices_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_notices" ADD CONSTRAINT "member_notices_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "member_notices_user_id_seq_idx" ON "member_notices" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "member_notices_exam_code_idx" ON "member_notices" USING btree ("exam_code");