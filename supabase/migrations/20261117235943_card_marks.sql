CREATE TYPE "public"."card_mark_verdict" AS ENUM('got', 'again');--> statement-breakpoint
CREATE TABLE "card_marks" (
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"verdict" "card_mark_verdict" NOT NULL,
	"marked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "card_marks_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "card_marks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_marks" ADD CONSTRAINT "card_marks_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_marks" ADD CONSTRAINT "card_marks_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_marks_card_id_idx" ON "card_marks" USING btree ("card_id");