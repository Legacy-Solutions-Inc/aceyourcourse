CREATE TYPE "public"."quiz_choice" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quiz_id" uuid NOT NULL,
	"position" integer,
	"question" text NOT NULL,
	"choice_a" text NOT NULL,
	"choice_b" text NOT NULL,
	"choice_c" text NOT NULL,
	"choice_d" text NOT NULL,
	"correct_choice" "quiz_choice" NOT NULL,
	"explanation" text NOT NULL,
	"figure_path" text,
	"removed_at" timestamp with time zone,
	CONSTRAINT "questions_position_positive" CHECK ("questions"."position" > 0),
	CONSTRAINT "questions_removed_has_no_position" CHECK (("questions"."position" is null) = ("questions"."removed_at" is not null)),
	CONSTRAINT "questions_question_length" CHECK (char_length("questions"."question") between 1 and 1000),
	CONSTRAINT "questions_choice_a_length" CHECK (char_length("questions"."choice_a") between 1 and 500),
	CONSTRAINT "questions_choice_b_length" CHECK (char_length("questions"."choice_b") between 1 and 500),
	CONSTRAINT "questions_choice_c_length" CHECK (char_length("questions"."choice_c") between 1 and 500),
	CONSTRAINT "questions_choice_d_length" CHECK (char_length("questions"."choice_d") between 1 and 500),
	CONSTRAINT "questions_explanation_length" CHECK (char_length("questions"."explanation") between 1 and 2000),
	CONSTRAINT "questions_figure_path_present" CHECK ("questions"."figure_path" <> '')
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "passing_score" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "shuffle" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "show_answers" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_quiz_id_position_idx" ON "questions" USING btree ("quiz_id","position");--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_passing_score_range" CHECK ("quizzes"."passing_score" between 1 and 100);