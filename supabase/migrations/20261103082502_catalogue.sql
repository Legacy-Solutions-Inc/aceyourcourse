CREATE TYPE "public"."faq_group" AS ENUM('shipping', 'paper', 'coverage', 'buying', 'authenticity');--> statement-breakpoint
CREATE TYPE "public"."marketplace" AS ENUM('shopee', 'lazada', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."product_format" AS ENUM('flash-cards', 'notebook', 'posters', 'bundle');--> statement-breakpoint
CREATE TYPE "public"."product_state" AS ENUM('live', 'coming-soon');--> statement-breakpoint
CREATE TABLE "announcement_messages" (
	"position" integer PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"href" text NOT NULL,
	"requires_member_app" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcement_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_pages" (
	"exam_code" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"show_subjects" boolean NOT NULL,
	"show_bundle_offer" boolean NOT NULL,
	"show_reviews" boolean NOT NULL,
	"bundle_product_id" text,
	"bundle_headline" text,
	"bundle_text" text,
	"bundle_button_label" text,
	"seo_title" text,
	"seo_description" text,
	"share_image" text,
	"official_exam_date" date
);
--> statement-breakpoint
ALTER TABLE "exam_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exams" (
	"code" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"board" text NOT NULL,
	"name" text NOT NULL,
	"long_name" text NOT NULL,
	"blurb" text NOT NULL,
	"made_for" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"slug" text NOT NULL,
	"group" "faq_group" NOT NULL,
	"order" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"review_quote_review_id" text,
	"review_quote_text" text,
	"popular_label" text,
	"requires_member_app" boolean NOT NULL,
	"show_on_faq_page" boolean NOT NULL,
	"show_coverage_table" boolean NOT NULL,
	CONSTRAINT "faqs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "faqs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_listings" (
	"product_id" text NOT NULL,
	"marketplace" "marketplace" NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "product_listings_product_id_marketplace_pk" PRIMARY KEY("product_id","marketplace")
);
--> statement-breakpoint
ALTER TABLE "product_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_photos" (
	"product_id" text NOT NULL,
	"position" integer NOT NULL,
	"src" text NOT NULL,
	"alt" text NOT NULL,
	CONSTRAINT "product_photos_product_id_position_pk" PRIMARY KEY("product_id","position")
);
--> statement-breakpoint
ALTER TABLE "product_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_subjects" (
	"product_id" text NOT NULL,
	"exam_code" text NOT NULL,
	"subject_code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "product_subjects_product_id_subject_code_pk" PRIMARY KEY("product_id","subject_code")
);
--> statement-breakpoint
ALTER TABLE "product_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_variations" (
	"product_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	CONSTRAINT "product_variations_product_id_position_pk" PRIMARY KEY("product_id","position")
);
--> statement-breakpoint
ALTER TABLE "product_variations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"slug" text NOT NULL,
	"exam_code" text NOT NULL,
	"title" text NOT NULL,
	"short_name" text NOT NULL,
	"format" "product_format" NOT NULL,
	"size" text NOT NULL,
	"edition" text,
	"state" "product_state" NOT NULL,
	"price_from" integer,
	"price_to" integer,
	"shopee_rating" double precision,
	"shopee_rating_count" integer,
	"shopee_units_sold" integer,
	"shopee_as_of" date,
	"deal" boolean NOT NULL,
	"available_in_app" boolean NOT NULL,
	"show_on_website" boolean NOT NULL,
	"whats_inside" text,
	"made_for" text[],
	"seo_title" text,
	"seo_description" text,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_id_exam_code_unique" UNIQUE("id","exam_code"),
	CONSTRAINT "products_shopee_figures_all_or_none" CHECK (num_nulls("products"."shopee_rating", "products"."shopee_rating_count", "products"."shopee_units_sold", "products"."shopee_as_of") in (0, 4))
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "promo_banner" (
	"id" integer PRIMARY KEY NOT NULL,
	"visible" boolean NOT NULL,
	"text" text NOT NULL,
	"button_label" text NOT NULL,
	"href" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	CONSTRAINT "promo_banner_single_row" CHECK ("promo_banner"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "promo_banner" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"product_id" text NOT NULL,
	"stars" smallint NOT NULL,
	"text" text NOT NULL,
	"variation" text,
	"helpful" integer NOT NULL,
	"marketplace" "marketplace" NOT NULL,
	"home_pin" integer,
	CONSTRAINT "reviews_stars_1_to_5" CHECK ("reviews"."stars" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subjects" (
	"exam_code" text NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "subjects_exam_code_code_pk" PRIMARY KEY("exam_code","code")
);
--> statement-breakpoint
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "website_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"shop_link_shopee" text,
	"shop_link_lazada" text,
	"shop_link_tiktok" text,
	"social_tiktok" text,
	"social_facebook" text,
	"social_instagram" text,
	"contact_email" text NOT NULL,
	"shop_rating" double precision NOT NULL,
	"shop_rating_count" integer NOT NULL,
	"shop_followers" text NOT NULL,
	"shop_stats_as_of" date NOT NULL,
	"announcement_id" text NOT NULL,
	CONSTRAINT "website_settings_single_row" CHECK ("website_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "website_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exam_pages" ADD CONSTRAINT "exam_pages_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "exam_pages" ADD CONSTRAINT "exam_pages_bundle_product_id_products_id_fk" FOREIGN KEY ("bundle_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_review_quote_review_id_reviews_id_fk" FOREIGN KEY ("review_quote_review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_listings" ADD CONSTRAINT "product_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_photos" ADD CONSTRAINT "product_photos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_subjects" ADD CONSTRAINT "product_subjects_product_fk" FOREIGN KEY ("product_id","exam_code") REFERENCES "public"."products"("id","exam_code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_subjects" ADD CONSTRAINT "product_subjects_subject_fk" FOREIGN KEY ("exam_code","subject_code") REFERENCES "public"."subjects"("exam_code","code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_exam_code_exams_code_fk" FOREIGN KEY ("exam_code") REFERENCES "public"."exams"("code") ON DELETE cascade ON UPDATE cascade;