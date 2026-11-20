CREATE TABLE "quiz_attempt_answers" (
	"attempt_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question_id" uuid NOT NULL,
	"choice" "quiz_choice",
	"is_correct" boolean NOT NULL,
	CONSTRAINT "quiz_attempt_answers_attempt_id_position_pk" PRIMARY KEY("attempt_id","position"),
	CONSTRAINT "quiz_attempt_answers_attempt_id_question_id_key" UNIQUE("attempt_id","question_id"),
	CONSTRAINT "quiz_attempt_answers_position_positive" CHECK ("quiz_attempt_answers"."position" > 0),
	CONSTRAINT "quiz_attempt_answers_unanswered_is_wrong" CHECK ("quiz_attempt_answers"."choice" is not null or not "quiz_attempt_answers"."is_correct")
);
--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"correct_count" integer NOT NULL,
	"question_count" integer NOT NULL,
	"score" integer NOT NULL,
	"passing_score" integer NOT NULL,
	CONSTRAINT "quiz_attempts_counts" CHECK ("quiz_attempts"."question_count" > 0 and "quiz_attempts"."correct_count" between 0 and "quiz_attempts"."question_count"),
	CONSTRAINT "quiz_attempts_score_rounded_down" CHECK ("quiz_attempts"."score" = ("quiz_attempts"."correct_count" * 100) / "quiz_attempts"."question_count"),
	CONSTRAINT "quiz_attempts_passing_score_range" CHECK ("quiz_attempts"."passing_score" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_attempt_answers_question_id_idx" ON "quiz_attempt_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_id_quiz_id_idx" ON "quiz_attempts" USING btree ("user_id","quiz_id","submitted_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_quiz_id_idx" ON "quiz_attempts" USING btree ("quiz_id");