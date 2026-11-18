CREATE TABLE "deck_positions" (
	"user_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "deck_positions_user_id_deck_id_pk" PRIMARY KEY("user_id","deck_id")
);
--> statement-breakpoint
ALTER TABLE "deck_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_days" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "study_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "study_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deck_positions" ADD CONSTRAINT "deck_positions_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_positions" ADD CONSTRAINT "deck_positions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_positions" ADD CONSTRAINT "deck_positions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_days" ADD CONSTRAINT "study_days_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_positions_deck_id_idx" ON "deck_positions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "deck_positions_card_id_idx" ON "deck_positions" USING btree ("card_id");