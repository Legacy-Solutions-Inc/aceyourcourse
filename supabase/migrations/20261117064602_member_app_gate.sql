CREATE TABLE "beta_testers" (
	"email" text PRIMARY KEY NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "beta_testers_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"added_at" timestamp with time zone NOT NULL,
	"added_by_email" text NOT NULL,
	"added_by_name" text NOT NULL,
	CONSTRAINT "beta_testers_email_lowercase" CHECK ("beta_testers"."email" = lower("beta_testers"."email"))
);
--> statement-breakpoint
ALTER TABLE "beta_testers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "members" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"joined_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;