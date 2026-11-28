CREATE TABLE "renewal_dismissals" (
	"user_id" uuid NOT NULL,
	"exam_code" text NOT NULL,
	"day" date NOT NULL,
	"dismissed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "renewal_dismissals_user_id_exam_code_pk" PRIMARY KEY("user_id","exam_code")
);
--> statement-breakpoint
ALTER TABLE "renewal_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "renewal_dismissals" ADD CONSTRAINT "renewal_dismissals_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_dismissals" ADD CONSTRAINT "renewal_dismissals_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "renewal_dismissals_exam_code_idx" ON "renewal_dismissals" USING btree ("exam_code");