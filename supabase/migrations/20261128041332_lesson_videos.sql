CREATE TYPE "public"."lesson_replacement_state" AS ENUM('uploading', 'processing', 'upload-failed');--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_id" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_seconds" integer;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "replacement_video_id" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "replacement_state" "lesson_replacement_state";--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_video_seconds_positive" CHECK ("lessons"."video_seconds" > 0);--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_video_when_state" CHECK (("lessons"."state" = 'no-video') = ("lessons"."video_id" is null));--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_length_when_ready" CHECK (("lessons"."state" in ('draft', 'published')) = ("lessons"."video_seconds" is not null));--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_replacement_when_ready" CHECK (("lessons"."replacement_video_id" is null) = ("lessons"."replacement_state" is null)
        and ("lessons"."replacement_video_id" is null or "lessons"."state" in ('draft', 'published')));