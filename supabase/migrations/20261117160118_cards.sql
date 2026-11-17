CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deck_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"note" text,
	"image_path" text,
	"front_hash" text NOT NULL,
	CONSTRAINT "cards_position_positive" CHECK ("cards"."position" > 0),
	CONSTRAINT "cards_front_length" CHECK (char_length("cards"."front") between 1 and 500),
	CONSTRAINT "cards_back_length" CHECK (char_length("cards"."back") between 1 and 2000),
	CONSTRAINT "cards_note_length" CHECK (char_length("cards"."note") between 1 and 1000),
	CONSTRAINT "cards_image_path_present" CHECK ("cards"."image_path" <> ''),
	CONSTRAINT "cards_front_hash_format" CHECK ("cards"."front_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_deck_id_position_idx" ON "cards" USING btree ("deck_id","position");