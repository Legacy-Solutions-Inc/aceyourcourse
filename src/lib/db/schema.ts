import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
} from "drizzle-orm/pg-core";

import { FAQ_GROUPS, PRODUCT_FORMATS } from "@/services/catalogue.schema";
import type { Marketplace } from "@/services/catalogue.types";

/**
 * Drizzle schema, the typed data layer behind the service seams
 * (docs/adr/0003, docs/adr/0006), and the source of truth for the migrations
 * in supabase/migrations (`pnpm db:generate`). There is no tenancy
 * (docs/adr/0008).
 *
 * The Catalogue: everything the Catalogue seam returns (catalogue.types.ts),
 * one table per record and per ordered list. Money is in integer centavos.
 * Each list keeps its order in a `position` column, because the Website breaks
 * ties by seed order. Every table has RLS on with no policies: Drizzle
 * connects with full access and the server decides, so the browser's
 * publishable key reaches nothing (spec, Phase 2 → Access is checked on the
 * server; src/lib/db/deny-all.db.test.ts).
 */

export const MARKETPLACES = [
  "shopee",
  "lazada",
  "tiktok",
] as const satisfies readonly Marketplace[];

export const marketplace = pgEnum("marketplace", MARKETPLACES);
export const productFormat = pgEnum("product_format", PRODUCT_FORMATS);
export const productState = pgEnum("product_state", ["live", "coming-soon"]);
export const faqGroup = pgEnum("faq_group", FAQ_GROUPS);

// ── Exams ───────────────────────────────────────────────────────────────────

export const exams = pgTable("exams", {
  code: text("code").primaryKey(),
  position: integer("position").notNull(),
  board: text("board").notNull(),
  name: text("name").notNull(),
  longName: text("long_name").notNull(),
  blurb: text("blurb").notNull(),
  madeFor: text("made_for").notNull(),
}).enableRLS();

/** An Exam's Subjects. A Subject's code is unique within its Exam. */
export const subjects = pgTable(
  "subjects",
  {
    examCode: text("exam_code")
      .notNull()
      .references(() => exams.code, { onDelete: "cascade", onUpdate: "cascade" }),
    code: text("code").notNull(),
    position: integer("position").notNull(),
    name: text("name").notNull(),
  },
  (t) => [primaryKey({ columns: [t.examCode, t.code] })],
).enableRLS();

// ── Products ────────────────────────────────────────────────────────────────

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    slug: text("slug").notNull().unique(),
    examCode: text("exam_code")
      .notNull()
      .references(() => exams.code, { onUpdate: "cascade" }),
    title: text("title").notNull(),
    shortName: text("short_name").notNull(),
    format: productFormat("format").notNull(),
    size: text("size").notNull(),
    edition: text("edition"),
    state: productState("state").notNull(),
    priceFrom: integer("price_from"),
    priceTo: integer("price_to"),
    // A Product's Shopee figures: all four, or none.
    shopeeRating: doublePrecision("shopee_rating"),
    shopeeRatingCount: integer("shopee_rating_count"),
    shopeeUnitsSold: integer("shopee_units_sold"),
    shopeeAsOf: date("shopee_as_of"),
    deal: boolean("deal").notNull(),
    availableInApp: boolean("available_in_app").notNull(),
    showOnWebsite: boolean("show_on_website").notNull(),
    whatsInside: text("whats_inside"),
    madeFor: text("made_for").array(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
  },
  (t) => [
    // The target of product_subjects' foreign key, which keeps a Product's
    // Subjects on its own Exam.
    unique("products_id_exam_code_unique").on(t.id, t.examCode),
    check(
      "products_shopee_figures_all_or_none",
      sql`num_nulls(${t.shopeeRating}, ${t.shopeeRatingCount}, ${t.shopeeUnitsSold}, ${t.shopeeAsOf}) in (0, 4)`,
    ),
  ],
).enableRLS();

/** The Subjects a Product covers, in order. Each is a Subject of the Product's Exam. */
export const productSubjects = pgTable(
  "product_subjects",
  {
    productId: text("product_id").notNull(),
    examCode: text("exam_code").notNull(),
    subjectCode: text("subject_code").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.subjectCode] }),
    foreignKey({
      name: "product_subjects_product_fk",
      columns: [t.productId, t.examCode],
      foreignColumns: [products.id, products.examCode],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      name: "product_subjects_subject_fk",
      columns: [t.examCode, t.subjectCode],
      foreignColumns: [subjects.examCode, subjects.code],
    }).onUpdate("cascade"),
  ],
).enableRLS();

export const productVariations = pgTable(
  "product_variations",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.position] })],
).enableRLS();

/** A Product's photos, in order; the first is the cover. */
export const productPhotos = pgTable(
  "product_photos",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    src: text("src").notNull(),
    alt: text("alt").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.position] })],
).enableRLS();

/** A Product's own Listing on a Marketplace: at most one per Marketplace. */
export const productListings = pgTable(
  "product_listings",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    marketplace: marketplace("marketplace").notNull(),
    url: text("url").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.marketplace] })],
).enableRLS();

// ── Reviews and FAQs ────────────────────────────────────────────────────────

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    stars: smallint("stars").notNull(),
    text: text("text").notNull(),
    variation: text("variation"),
    helpful: integer("helpful").notNull(),
    marketplace: marketplace("marketplace").notNull(),
    homePin: integer("home_pin"),
  },
  (t) => [check("reviews_stars_1_to_5", sql`${t.stars} between 1 and 5`)],
).enableRLS();

export const faqs = pgTable("faqs", {
  id: text("id").primaryKey(),
  position: integer("position").notNull(),
  slug: text("slug").notNull().unique(),
  group: faqGroup("group").notNull(),
  order: integer("order").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  // Deleting the quoted Review drops the quote.
  reviewQuoteReviewId: text("review_quote_review_id").references(() => reviews.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  reviewQuoteText: text("review_quote_text"),
  popularLabel: text("popular_label"),
  requiresMemberApp: boolean("requires_member_app").notNull(),
  showOnFaqPage: boolean("show_on_faq_page").notNull(),
  showCoverageTable: boolean("show_coverage_table").notNull(),
}).enableRLS();

// ── Exam pages ──────────────────────────────────────────────────────────────

/** What Staff edit about an Exam's page. An Exam with no row gets examPageDefaults. */
export const examPages = pgTable("exam_pages", {
  examCode: text("exam_code")
    .primaryKey()
    .references(() => exams.code, { onDelete: "cascade", onUpdate: "cascade" }),
  position: integer("position").notNull(),
  showSubjects: boolean("show_subjects").notNull(),
  showBundleOffer: boolean("show_bundle_offer").notNull(),
  showReviews: boolean("show_reviews").notNull(),
  // The bundle offer. Deleting its Product drops the offer.
  bundleProductId: text("bundle_product_id").references(() => products.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  bundleHeadline: text("bundle_headline"),
  bundleText: text("bundle_text"),
  bundleButtonLabel: text("bundle_button_label"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  shareImage: text("share_image"),
  officialExamDate: date("official_exam_date"),
}).enableRLS();

// ── Website settings ────────────────────────────────────────────────────────

/** The one row of Website settings (id 1), with the shop stats and the announcement's id. */
export const websiteSettings = pgTable(
  "website_settings",
  {
    id: integer("id").primaryKey(),
    shopLinkShopee: text("shop_link_shopee"),
    shopLinkLazada: text("shop_link_lazada"),
    shopLinkTiktok: text("shop_link_tiktok"),
    socialTiktok: text("social_tiktok"),
    socialFacebook: text("social_facebook"),
    socialInstagram: text("social_instagram"),
    contactEmail: text("contact_email").notNull(),
    shopRating: doublePrecision("shop_rating").notNull(),
    shopRatingCount: integer("shop_rating_count").notNull(),
    shopFollowers: text("shop_followers").notNull(),
    shopStatsAsOf: date("shop_stats_as_of").notNull(),
    announcementId: text("announcement_id").notNull(),
  },
  (t) => [check("website_settings_single_row", sql`${t.id} = 1`)],
).enableRLS();

/** The announcement bar's messages, in order. */
export const announcementMessages = pgTable("announcement_messages", {
  position: integer("position").primaryKey(),
  text: text("text").notNull(),
  href: text("href").notNull(),
  requiresMemberApp: boolean("requires_member_app").notNull(),
}).enableRLS();

/** The promo banner: one row (id 1), or none. */
export const promoBanner = pgTable(
  "promo_banner",
  {
    id: integer("id").primaryKey(),
    visible: boolean("visible").notNull(),
    text: text("text").notNull(),
    buttonLabel: text("button_label").notNull(),
    href: text("href").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
  },
  (t) => [check("promo_banner_single_row", sql`${t.id} = 1`)],
).enableRLS();
