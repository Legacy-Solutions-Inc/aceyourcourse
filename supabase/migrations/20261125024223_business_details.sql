ALTER TABLE "website_settings" ADD COLUMN "business_name" text DEFAULT 'Ace Your Course' NOT NULL;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "business_tin" text;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "business_vat_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "website_settings" ADD CONSTRAINT "website_settings_business_tin_format" CHECK ("website_settings"."business_tin" ~ '^[0-9]{3}-[0-9]{3}-[0-9]{3}(-[0-9]{3}|-[0-9]{5})?$');