CREATE TABLE "member_consents" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_consents_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"terms_version" text NOT NULL,
	"privacy_version" text NOT NULL,
	"agreed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "member_consents_terms_version_format" CHECK ("member_consents"."terms_version" ~ '^[0-9]+[.][0-9]+$'),
	CONSTRAINT "member_consents_privacy_version_format" CHECK ("member_consents"."privacy_version" ~ '^[0-9]+[.][0-9]+$')
);
--> statement-breakpoint
ALTER TABLE "member_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_consents" ADD CONSTRAINT "member_consents_user_id_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_consents_user_id_seq_idx" ON "member_consents" USING btree ("user_id","seq");