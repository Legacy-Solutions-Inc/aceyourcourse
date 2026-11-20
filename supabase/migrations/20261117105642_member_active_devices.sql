CREATE TABLE "member_active_devices" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"device_label" text NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "member_active_devices_token_hash_format" CHECK ("member_active_devices"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "member_active_devices_device_label_length" CHECK (char_length("member_active_devices"."device_label") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "member_active_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "member_device_switches" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_device_switches_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"device_label" text NOT NULL,
	"switched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "member_device_switches_device_label_length" CHECK (char_length("member_device_switches"."device_label") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "member_device_switches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_active_devices" ADD CONSTRAINT "member_active_devices_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_device_switches" ADD CONSTRAINT "member_device_switches_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_device_switches_user_id_seq_idx" ON "member_device_switches" USING btree ("user_id","seq");