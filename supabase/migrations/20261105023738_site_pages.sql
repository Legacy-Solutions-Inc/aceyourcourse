CREATE TYPE "public"."site_page" AS ENUM('home', 'about', 'products', 'faq', 'reviews');--> statement-breakpoint
CREATE TABLE "site_pages" (
	"page" "site_page" PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"share_image" text
);
--> statement-breakpoint
ALTER TABLE "site_pages" ENABLE ROW LEVEL SECURITY;