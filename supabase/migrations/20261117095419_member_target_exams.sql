CREATE TABLE "member_target_exams" (
	"user_id" uuid NOT NULL,
	"exam_code" text NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "member_target_exams_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"member_exam_date" date,
	"added_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "member_target_exams_user_id_exam_code_pk" PRIMARY KEY("user_id","exam_code")
);
--> statement-breakpoint
ALTER TABLE "member_target_exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "selected_exam_code" text;--> statement-breakpoint
ALTER TABLE "member_target_exams" ADD CONSTRAINT "member_target_exams_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_target_exams" ADD CONSTRAINT "member_target_exams_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "member_target_exams_exam_code_idx" ON "member_target_exams" USING btree ("exam_code");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_selected_exam_code_exams_code_fk" FOREIGN KEY ("selected_exam_code") REFERENCES "public"."exams"("code") ON DELETE set null ON UPDATE cascade;