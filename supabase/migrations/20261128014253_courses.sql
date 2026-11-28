CREATE TYPE "public"."course_access" AS ENUM('included', 'sold-separately');--> statement-breakpoint
CREATE TYPE "public"."lesson_state" AS ENUM('no-video', 'uploading', 'processing', 'draft', 'published', 'upload-failed');--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "course_modules_position_positive" CHECK ("course_modules"."position" > 0),
	CONSTRAINT "course_modules_title_length" CHECK (char_length("course_modules"."title") between 1 and 120),
	CONSTRAINT "course_modules_title_trimmed" CHECK ("course_modules"."title" = btrim("course_modules"."title"))
);
--> statement-breakpoint
ALTER TABLE "course_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exam_code" text NOT NULL,
	"subject_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_src" text,
	"visibility" "content_visibility" DEFAULT 'hidden' NOT NULL,
	"access" "course_access" DEFAULT 'included' NOT NULL,
	"price_centavos" integer,
	"on_sale" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_title_length" CHECK (char_length("courses"."title") between 1 and 120),
	CONSTRAINT "courses_title_trimmed" CHECK ("courses"."title" = btrim("courses"."title")),
	CONSTRAINT "courses_description_length" CHECK (char_length("courses"."description") <= 2000),
	CONSTRAINT "courses_cover_src_present" CHECK ("courses"."cover_src" <> ''),
	CONSTRAINT "courses_price_whole_pesos" CHECK ("courses"."price_centavos" between 100 and 9999900 and "courses"."price_centavos" % 100 = 0),
	CONSTRAINT "courses_on_sale_priced_and_sold_separately" CHECK (not "courses"."on_sale" or ("courses"."access" = 'sold-separately' and "courses"."price_centavos" is not null))
);
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"free_preview" boolean DEFAULT false NOT NULL,
	"state" "lesson_state" DEFAULT 'no-video' NOT NULL,
	CONSTRAINT "lessons_position_positive" CHECK ("lessons"."position" > 0),
	CONSTRAINT "lessons_title_length" CHECK (char_length("lessons"."title") between 1 and 120),
	CONSTRAINT "lessons_title_trimmed" CHECK ("lessons"."title" = btrim("lessons"."title")),
	CONSTRAINT "lessons_notes_length" CHECK (char_length("lessons"."notes") <= 5000)
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_fk" FOREIGN KEY ("exam_code","subject_code") REFERENCES "public"."subjects"("exam_code","code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_modules_course_id_position_idx" ON "course_modules" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "courses_subject_idx" ON "courses" USING btree ("exam_code","subject_code");--> statement-breakpoint
CREATE INDEX "lessons_module_id_position_idx" ON "lessons" USING btree ("module_id","position");