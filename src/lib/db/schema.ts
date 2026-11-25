import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { PRIVACY_REQUEST_STATUSES, PRIVACY_REQUEST_TYPES } from "@/lib/member-app/privacy-requests";
import { FIRST_REFERENCE_NUMBER, ORDER_STATUSES } from "@/lib/payments/order-ledger";
import { PAYMENT_METHODS } from "@/lib/payments/payment-methods";
import { REVIEWER_PDF_FAILURES } from "@/lib/reviewer-pdfs/job";
import { PDF_NAME_MAX } from "@/lib/reviewer-pdfs/pdf-file";
import { READER_ZOOMS } from "@/lib/reviewer-pdfs/reader";
import {
  DEFAULT_QUIZ_SETTINGS,
  PASSING_SCORE_MAX,
  PASSING_SCORE_MIN,
  QUESTION_TEXT_LIMITS,
  QUIZ_CHOICES,
} from "@/lib/quizzes/quiz-rules";
import { FAQ_GROUPS, PRODUCT_FORMATS, SITE_PAGES } from "@/services/catalogue.schema";
import type { AboutContent, Marketplace } from "@/services/catalogue.types";
import {
  CARD_MARK_VERDICTS,
  CONTENT_VISIBILITIES,
  REVIEWER_PDF_STATUSES,
} from "@/services/content.types";
import { NOTICE_KINDS } from "@/services/member.types";

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
 *
 * The Admin's own records: the staff list with its Invites, denied sign-ins,
 * Staff Activity, and each editable record's save stamp, which the conflict
 * check compares (CONVENTIONS §3).
 *
 * The Member App (Phase 3): the Beta Tester list, the Members and their
 * records (consent, Target Exams, Active Device), the content model (Topics
 * and their decks, quizzes and Reviewer PDFs), the Members' study records
 * (Card Marks, Study Days, deck positions), and the Access Passes.
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
export const sitePage = pgEnum("site_page", SITE_PAGES);

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

/**
 * What Staff edit about each Site page (ticket 20): its SEO overrides and
 * share image, and About's text and photos (ticket 21). A page with no row
 * uses its text in code, so the table starts empty and nothing needs loading.
 */
export const sitePages = pgTable("site_pages", {
  page: sitePage("page").primaryKey(),
  position: integer("position").notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  shareImage: text("share_image"),
  /**
   * About's saved fields, each null for today's text. Null until About's
   * first save, and on every other Site page. Checked by validateCatalogueSeed
   * on every save; a whole fixed-shape record, so it's one column.
   */
  about: jsonb("about").$type<AboutContent>(),
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
    // The seller on Payment Acknowledgements (Phase 4, ticket 06).
    businessName: text("business_name").notNull().default("Ace Your Course"),
    businessAddress: text("business_address"),
    // With dashes, "123-456-789" or with a 3- or 5-digit branch code.
    businessTin: text("business_tin"),
    businessVatRegistered: boolean("business_vat_registered").notNull().default(false),
  },
  (t) => [
    check("website_settings_single_row", sql`${t.id} = 1`),
    check(
      "website_settings_business_tin_format",
      sql`${t.businessTin} ~ '^[0-9]{3}-[0-9]{3}-[0-9]{3}(-[0-9]{3}|-[0-9]{5})?$'`,
    ),
  ],
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

// ── The Admin ───────────────────────────────────────────────────────────────

/** A time with its zone, as a Date: the Admin's ISO strings map to and from it. */
const at = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const staffRole = pgEnum("staff_role", ["owner", "editor"]);
export const staffStatus = pgEnum("staff_status", ["active", "invited"]);
export const deniedReason = pgEnum("denied_reason", ["not-staff", "invite-expired"]);

/**
 * The staff list: each Staff User, and each Invite not yet used. An email is
 * on it once, lowercased. An Invite becomes Staff on its first sign-in, so the
 * same row changes status. Each list keeps its order in `position`.
 */
export const staff = pgTable(
  "staff",
  {
    email: text("email").primaryKey(),
    position: integer("position").notNull(),
    status: staffStatus("status").notNull(),
    role: staffRole("role").notNull(),
    name: text("name"),
    addedAt: at("added_at"),
    lastSignedInAt: at("last_signed_in_at"),
    invitedAt: at("invited_at"),
    expiresAt: at("expires_at"),
  },
  (t) => [
    check("staff_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check(
      "staff_active_or_invited",
      sql`(${t.status} = 'active' and ${t.name} is not null and ${t.addedAt} is not null)
        or (${t.status} = 'invited' and ${t.invitedAt} is not null and ${t.expiresAt} is not null)`,
    ),
  ],
).enableRLS();

/** Sign-ins refused because the email isn't Staff, newest last (`seq`). */
export const deniedSignIns = pgTable(
  "denied_sign_ins",
  {
    id: uuid("id").primaryKey(),
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
    reason: deniedReason("reason").notNull(),
    at: at("at").notNull(),
  },
  (t) => [index("denied_sign_ins_email_at_idx").on(t.email, t.at)],
).enableRLS();

/**
 * Staff Activity: one record per entity each Admin write changed, with the
 * values before and after, in the order they were written (`seq`). It keeps
 * the actor's email and name, so it outlives their removal from the staff list.
 */
export const staffActivity = pgTable("staff_activity", {
  id: uuid("id").primaryKey(),
  seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
  at: at("at").notNull(),
  actorEmail: text("actor_email").notNull(),
  actorName: text("actor_name").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
}).enableRLS();

/**
 * Each editable record's last save: when, and by whom. A record is what one
 * Admin editor saves, keyed as the sample arm keys it (e.g. `product:prd-001`,
 * `product-flags:prd-001`, `exam-page:CE:header`), so a toggle and an editor
 * on the same row never conflict. The conflict check updates a stamp only
 * where `updated_at` still holds the value the write read. A record with no
 * row was last changed by the seed, whose time the `seeded` row holds.
 */
export const recordStamps = pgTable("record_stamps", {
  record: text("record").primaryKey(),
  updatedAt: at("updated_at").notNull(),
  updatedBy: text("updated_by"),
}).enableRLS();

// ── The Member App ──────────────────────────────────────────────────────────

/**
 * The Beta Tester list: the Google emails an Owner lets into the Member App
 * while its switch is off, in the order they were added (`seq`). An email is
 * on it once, lowercased, and can be added before its User exists. It keeps
 * who added it as they were then, so it outlives their removal from the staff
 * list.
 */
export const betaTesters = pgTable(
  "beta_testers",
  {
    email: text("email").primaryKey(),
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    addedAt: at("added_at").notNull(),
    addedByEmail: text("added_by_email").notNull(),
    addedByName: text("added_by_name").notNull(),
  },
  (t) => [check("beta_testers_email_lowercase", sql`${t.email} = lower(${t.email})`)],
).enableRLS();

/**
 * The Members: one row per User who has passed the Member App gate, made on
 * their first pass. `user_id` is the Supabase User's id (auth.users.id). It
 * carries no foreign key: with sample data on a local database, "Sign in as"
 * stands in for Google and there is no Supabase User to point at.
 */
export const members = pgTable("members", {
  userId: uuid("user_id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  joinedAt: at("joined_at").notNull(),
  // The Exam the Member last selected in the exam switcher. The Member seam
  // reads it only while it's one of their Target Exams.
  selectedExamCode: text("selected_exam_code").references(() => exams.code, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}).enableRLS();

/**
 * Each Member's Target Exams (spec, Phase 3 → Target Exams): an Exam plus the
 * Member's own Exam Date for it, in the order first added (`seq`).
 * `member_exam_date` is null until the Member edits the date: until then the
 * Exam Date is read from the Exam's Official Exam Date, so a Staff change
 * moves everyone who never edited. Removing one only sets `removed_at`, so
 * adding it back restores its date (and, later, its progress). Deleting the
 * Member or the Exam deletes the row.
 */
export const memberTargetExams = pgTable(
  "member_target_exams",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    examCode: text("exam_code")
      .notNull()
      .references(() => exams.code, { onDelete: "cascade", onUpdate: "cascade" }),
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    memberExamDate: date("member_exam_date"),
    addedAt: at("added_at").notNull(),
    removedAt: at("removed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.examCode] }),
    index("member_target_exams_exam_code_idx").on(t.examCode),
  ],
).enableRLS();

/**
 * Each Member's agreements to the Terms of Use and the Privacy Policy, with
 * the versions agreed to (spec, Phase 3 → Consent). A row is added each time
 * the Member agrees and is never changed, so the history is kept; the latest
 * (`seq`) is the one the consent check reads. Only a Member agrees, and
 * deleting the Member deletes their agreements.
 */
export const memberConsents = pgTable(
  "member_consents",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    termsVersion: text("terms_version").notNull(),
    privacyVersion: text("privacy_version").notNull(),
    agreedAt: at("agreed_at").notNull(),
  },
  (t) => [
    index("member_consents_user_id_seq_idx").on(t.userId, t.seq),
    check("member_consents_terms_version_format", sql`${t.termsVersion} ~ '^[0-9]+[.][0-9]+$'`),
    check("member_consents_privacy_version_format", sql`${t.privacyVersion} ~ '^[0-9]+[.][0-9]+$'`),
  ],
).enableRLS();

/**
 * Each Member's Active Device (spec, Phase 3 → Active Device; ADR 0011): one
 * row per Member, replaced by every claim. It holds the SHA-256 hash of the
 * token in the device's cookie, never the token itself, with the device's
 * label from its User-Agent and when it was claimed. The Admin never checks
 * its own requests against it: Users shows its label and when it was claimed,
 * and force sign-out deletes it (ticket 16). Deleting the Member deletes it.
 */
export const memberActiveDevices = pgTable(
  "member_active_devices",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => members.userId, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    deviceLabel: text("device_label").notNull(),
    claimedAt: at("claimed_at").notNull(),
  },
  (t) => [
    check("member_active_devices_token_hash_format", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "member_active_devices_device_label_length",
      sql`char_length(${t.deviceLabel}) between 1 and 80`,
    ),
  ],
).enableRLS();

/**
 * Each Member's Active Device switch log: a row for every claim, the first one
 * too, with its time and the device's label, in the order made (`seq`). Never
 * changed. Owners see the count (spec, Phase 3 → Users and Member detail).
 * Deleting the Member deletes their log.
 */
export const memberDeviceSwitches = pgTable(
  "member_device_switches",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    deviceLabel: text("device_label").notNull(),
    switchedAt: at("switched_at").notNull(),
  },
  (t) => [
    index("member_device_switches_user_id_seq_idx").on(t.userId, t.seq),
    check(
      "member_device_switches_device_label_length",
      sql`char_length(${t.deviceLabel}) between 1 and 80`,
    ),
  ],
).enableRLS();

// ── Member App content ──────────────────────────────────────────────────────

export const contentVisibility = pgEnum("content_visibility", CONTENT_VISIBILITIES);
export const reviewerPdfStatus = pgEnum("reviewer_pdf_status", REVIEWER_PDF_STATUSES);
export const reviewerPdfFailure = pgEnum("reviewer_pdf_failure", REVIEWER_PDF_FAILURES);

/**
 * The Topics (spec, Phase 3 → Content model): units of study within a
 * Subject, in its order (`position`). A name is unique within its Subject,
 * ignoring case, and kept trimmed. Deleting a Subject (or its Exam) deletes
 * its Topics, but a Topic with a deck, quiz or Reviewer PDF can't be deleted
 * (their foreign keys restrict it), so neither can its Subject or Exam.
 * Progress is tied to the Topic's id, never its name.
 */
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey(),
    examCode: text("exam_code").notNull(),
    subjectCode: text("subject_code").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    foreignKey({
      name: "topics_subject_fk",
      columns: [t.examCode, t.subjectCode],
      foreignColumns: [subjects.examCode, subjects.code],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    uniqueIndex("topics_subject_name_key").on(t.examCode, t.subjectCode, sql`lower(${t.name})`),
    check("topics_name_length", sql`char_length(${t.name}) between 1 and 120`),
    check("topics_name_trimmed", sql`${t.name} = btrim(${t.name})`),
    check("topics_position_positive", sql`${t.position} > 0`),
  ],
).enableRLS();

/**
 * Each Topic's flashcard deck, at most one: Hidden until Staff make it
 * Visible, and optionally Free Preview. Its cards are in `cards`.
 */
export const decks = pgTable("decks", {
  id: uuid("id").primaryKey(),
  topicId: uuid("topic_id")
    .notNull()
    .unique("decks_topic_id_key")
    .references(() => topics.id, { onDelete: "restrict" }),
  visibility: contentVisibility("visibility").notNull().default("hidden"),
  freePreview: boolean("free_preview").notNull().default(false),
}).enableRLS();

/**
 * Each deck's flashcards, in its order (`position`; ticket 06): front text, a
 * back and an optional note, each in the formula notation, and an optional
 * back image in the private content bucket. `front_hash` is the SHA-256 of
 * the front as a re-import matches it (trimmed, single spaces, case kept):
 * Replace keeps a card's id, and so every Member's Card Mark on it, while its
 * front is unchanged. Deleting the deck deletes its cards.
 */
export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    note: text("note"),
    imagePath: text("image_path"),
    frontHash: text("front_hash").notNull(),
  },
  (t) => [
    index("cards_deck_id_position_idx").on(t.deckId, t.position),
    check("cards_position_positive", sql`${t.position} > 0`),
    check("cards_front_length", sql`char_length(${t.front}) between 1 and 500`),
    check("cards_back_length", sql`char_length(${t.back}) between 1 and 2000`),
    check("cards_note_length", sql`char_length(${t.note}) between 1 and 1000`),
    check("cards_image_path_present", sql`${t.imagePath} <> ''`),
    check("cards_front_hash_format", sql`${t.frontHash} ~ '^[0-9a-f]{64}$'`),
  ],
).enableRLS();

export const cardMarkVerdict = pgEnum("card_mark_verdict", CARD_MARK_VERDICTS);

/**
 * The Card Marks (CONTEXT.md; spec, Phase 3 → Progress storage): each
 * Member's latest verdict on a card, Got it or Review again, as current state,
 * one row per Member and card. Deleting the card deletes every Member's mark
 * on it (the card editor, ticket 07; a Replace import's removed cards), and
 * deleting the Member deletes theirs. The flashcard player writes them
 * (ticket 08). The index on card_id serves that cascade, which the primary
 * key, led by user_id, can't.
 */
export const cardMarks = pgTable(
  "card_marks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    verdict: cardMarkVerdict("verdict").notNull(),
    markedAt: at("marked_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.cardId] }),
    index("card_marks_card_id_idx").on(t.cardId),
  ],
).enableRLS();

/**
 * The Study Days (CONTEXT.md; spec, Phase 3 → Progress storage): each Manila
 * calendar day on which a Member studied, one row per Member and day. Marking
 * a card records the day (ticket 08); the Study Streak is counted from them
 * (ticket 15). Deleting the Member deletes theirs.
 */
export const studyDays = pgTable(
  "study_days",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    day: date("day").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
).enableRLS();

/**
 * Where each Member left each deck (spec, Phase 3 → Resume; ticket 08): the
 * card to continue from, one row per Member and deck, replaced as they move
 * through it and deleted when they finish it. Deleting the card, the deck or
 * the Member deletes it, so the deck then opens at its first card. The
 * indexes on deck_id and card_id serve those cascades, which the primary key,
 * led by user_id, can't.
 */
export const deckPositions = pgTable(
  "deck_positions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    savedAt: at("saved_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.deckId] }),
    index("deck_positions_deck_id_idx").on(t.deckId),
    index("deck_positions_card_id_idx").on(t.cardId),
  ],
).enableRLS();

/**
 * Each Topic's quiz, at most one: Hidden until Staff make it Visible, and
 * optionally Free Preview, with its settings (ticket 09): the passing score,
 * a whole percentage from 1 to 100 (70 by default), whether its questions are
 * shuffled, and whether Members see the answers after scoring. Its questions
 * are in `questions`.
 */
export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey(),
    topicId: uuid("topic_id")
      .notNull()
      .unique("quizzes_topic_id_key")
      .references(() => topics.id, { onDelete: "restrict" }),
    visibility: contentVisibility("visibility").notNull().default("hidden"),
    freePreview: boolean("free_preview").notNull().default(false),
    passingScore: integer("passing_score").notNull().default(DEFAULT_QUIZ_SETTINGS.passingScore),
    shuffle: boolean("shuffle").notNull().default(DEFAULT_QUIZ_SETTINGS.shuffle),
    showAnswers: boolean("show_answers").notNull().default(DEFAULT_QUIZ_SETTINGS.showAnswers),
  },
  (t) => [
    check(
      "quizzes_passing_score_range",
      sql`${t.passingScore} between ${sql.raw(String(PASSING_SCORE_MIN))} and ${sql.raw(String(PASSING_SCORE_MAX))}`,
    ),
  ],
).enableRLS();

export const quizChoice = pgEnum("quiz_choice", QUIZ_CHOICES);

/**
 * Each quiz's questions (ticket 09): the question, four choices A–D, the
 * correct choice and an explanation, each in the formula notation, and an
 * optional figure in the private content bucket. A question in the quiz has
 * its place in the quiz's order (`position`). A question taken out of the
 * quiz (a Replace import; the question editor's delete, ticket 10) is never
 * deleted: it's marked removed (`removed_at`, its place cleared), so every
 * Member's old attempts that answered it, and their Best Scores, keep it, and
 * show it as "This question has since been removed" (ticket 11). Retakes use
 * the questions still in the quiz. Deleting the quiz deletes its questions.
 */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    position: integer("position"),
    question: text("question").notNull(),
    choiceA: text("choice_a").notNull(),
    choiceB: text("choice_b").notNull(),
    choiceC: text("choice_c").notNull(),
    choiceD: text("choice_d").notNull(),
    correctChoice: quizChoice("correct_choice").notNull(),
    explanation: text("explanation").notNull(),
    figurePath: text("figure_path"),
    removedAt: at("removed_at"),
  },
  (t) => {
    const length = (column: typeof t.question, max: number) =>
      sql`char_length(${column}) between 1 and ${sql.raw(String(max))}`;
    return [
      index("questions_quiz_id_position_idx").on(t.quizId, t.position),
      check("questions_position_positive", sql`${t.position} > 0`),
      check(
        "questions_removed_has_no_position",
        sql`(${t.position} is null) = (${t.removedAt} is not null)`,
      ),
      check("questions_question_length", length(t.question, QUESTION_TEXT_LIMITS.question)),
      check("questions_choice_a_length", length(t.choiceA, QUESTION_TEXT_LIMITS.choice)),
      check("questions_choice_b_length", length(t.choiceB, QUESTION_TEXT_LIMITS.choice)),
      check("questions_choice_c_length", length(t.choiceC, QUESTION_TEXT_LIMITS.choice)),
      check("questions_choice_d_length", length(t.choiceD, QUESTION_TEXT_LIMITS.choice)),
      check(
        "questions_explanation_length",
        length(t.explanation, QUESTION_TEXT_LIMITS.explanation),
      ),
      check("questions_figure_path_present", sql`${t.figurePath} <> ''`),
    ];
  },
).enableRLS();

/**
 * Every Member's Quiz Attempts (CONTEXT.md; spec, Phase 3 → Progress storage,
 * Quizzes are graded on the server; ticket 11): each submitted pass through a
 * quiz, marked on the server and kept for good. The id is the attempt's own,
 * made when it started, so the same attempt posted twice is saved once. The
 * score is the right answers as a whole percentage of the questions in the
 * quiz then, rounded down, which the check holds it to; the passing score is
 * the quiz's then. A Member's Best Score on a quiz is the highest score of
 * their attempts at it: no table keeps it, so a lower retake can't lower it
 * and a correction can't change it. Deleting the Member or the quiz deletes
 * them. The index on (user_id, quiz_id) serves each Member's attempts list;
 * the one on quiz_id the cascade.
 */
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    submittedAt: at("submitted_at").notNull(),
    correctCount: integer("correct_count").notNull(),
    questionCount: integer("question_count").notNull(),
    score: integer("score").notNull(),
    passingScore: integer("passing_score").notNull(),
  },
  (t) => [
    index("quiz_attempts_user_id_quiz_id_idx").on(t.userId, t.quizId, t.submittedAt),
    index("quiz_attempts_quiz_id_idx").on(t.quizId),
    check(
      "quiz_attempts_counts",
      sql`${t.questionCount} > 0 and ${t.correctCount} between 0 and ${t.questionCount}`,
    ),
    check(
      "quiz_attempts_score_rounded_down",
      sql`${t.score} = (${t.correctCount} * 100) / ${t.questionCount}`,
    ),
    check(
      "quiz_attempts_passing_score_range",
      sql`${t.passingScore} between ${sql.raw(String(PASSING_SCORE_MIN))} and ${sql.raw(String(PASSING_SCORE_MAX))}`,
    ),
  ],
).enableRLS();

/**
 * Each Quiz Attempt's answers, in the order the Member saw the questions
 * (`position`): the choice they picked, or none for one left unanswered, and
 * whether it was right when they submitted, kept as it was, so a later
 * correction never changes the attempt. A question taken out of the quiz is
 * kept, marked removed (`questions`), so its answers stay. Deleting the
 * attempt deletes them.
 */
export const quizAttemptAnswers = pgTable(
  "quiz_attempt_answers",
  {
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    choice: quizChoice("choice"),
    isCorrect: boolean("is_correct").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.attemptId, t.position] }),
    unique("quiz_attempt_answers_attempt_id_question_id_key").on(t.attemptId, t.questionId),
    index("quiz_attempt_answers_question_id_idx").on(t.questionId),
    check("quiz_attempt_answers_position_positive", sql`${t.position} > 0`),
    check(
      "quiz_attempt_answers_unanswered_is_wrong",
      sql`${t.choice} is not null or not ${t.isCorrect}`,
    ),
  ],
).enableRLS();

/**
 * The Reviewer PDFs: at most one per Topic, and none until Staff place it
 * under one, which Publishing needs.
 *
 * An Editor's upload (ticket 12) adds its file and its job: the file's name
 * and size, when it was uploaded, and the job that splits it into page images
 * (ADR 0012): the PDF's page count once read, the pages done, the heartbeat
 * each run beats after every page, how often the cron has restarted it, and
 * why it failed. The original and the page images are in the private
 * `reviewer-pdfs` bucket, at paths made from the id
 * (src/lib/reviewer-pdfs/paths.ts), so no row lists them: pages 1 to
 * `pages_done` are there. A
 * Reviewer PDF with no file (`uploaded_at` null) is the sample data's, from
 * before uploads.
 */
export const reviewerPdfs = pgTable(
  "reviewer_pdfs",
  {
    id: uuid("id").primaryKey(),
    topicId: uuid("topic_id")
      .unique("reviewer_pdfs_topic_id_key")
      .references(() => topics.id, { onDelete: "restrict" }),
    status: reviewerPdfStatus("status").notNull().default("processing"),
    freePreview: boolean("free_preview").notNull().default(false),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    uploadedAt: at("uploaded_at"),
    pageCount: integer("page_count"),
    pagesDone: integer("pages_done").notNull().default(0),
    heartbeatAt: at("heartbeat_at"),
    restarts: smallint("restarts").notNull().default(0),
    failure: reviewerPdfFailure("failure"),
  },
  (t) => [
    check(
      "reviewer_pdfs_published_has_topic",
      sql`${t.status} <> 'published' or ${t.topicId} is not null`,
    ),
    // Its file comes whole: a name, a size and when, or none of them.
    check(
      "reviewer_pdfs_file_whole",
      sql`(${t.fileName} is null) = (${t.uploadedAt} is null) and (${t.fileSize} is null) = (${t.uploadedAt} is null)`,
    ),
    check(
      "reviewer_pdfs_file_name_length",
      sql`${t.fileName} is null or char_length(${t.fileName}) between 1 and ${sql.raw(String(PDF_NAME_MAX))}`,
    ),
    check("reviewer_pdfs_file_size_positive", sql`${t.fileSize} is null or ${t.fileSize} > 0`),
    check("reviewer_pdfs_page_count_positive", sql`${t.pageCount} is null or ${t.pageCount} > 0`),
    check(
      "reviewer_pdfs_pages_done_range",
      sql`${t.pagesDone} between 0 and coalesce(${t.pageCount}, 0)`,
    ),
    // A Draft from an upload has every page.
    check(
      "reviewer_pdfs_draft_has_every_page",
      sql`${t.status} <> 'draft' or ${t.pageCount} is null or ${t.pagesDone} = ${t.pageCount}`,
    ),
    check("reviewer_pdfs_restarts_positive", sql`${t.restarts} >= 0`),
    // A failed one says why, and only a failed one.
    check(
      "reviewer_pdfs_failed_has_failure",
      sql`(${t.status} = 'failed') = (${t.failure} is not null)`,
    ),
  ],
).enableRLS();

/**
 * The Reviewer PDF pages each Member has viewed (spec, Phase 3 → Progress
 * storage; ticket 14): one row per Member, Reviewer PDF and page, kept from
 * the first time the page's stamped image was sent to them. Topic % counts
 * the share of a Reviewer PDF's pages viewed (ticket 15). Deleting the
 * Reviewer PDF or the Member deletes them; the index on reviewer_pdf_id
 * serves that cascade, which the primary key, led by user_id, can't.
 */
export const reviewerPageViews = pgTable(
  "reviewer_page_views",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    reviewerPdfId: uuid("reviewer_pdf_id")
      .notNull()
      .references(() => reviewerPdfs.id, { onDelete: "cascade" }),
    page: integer("page").notNull(),
    viewedAt: at("viewed_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.reviewerPdfId, t.page] }),
    index("reviewer_page_views_reviewer_pdf_id_idx").on(t.reviewerPdfId),
    check("reviewer_page_views_page_positive", sql`${t.page} > 0`),
  ],
).enableRLS();

/**
 * Where each Member left each Reviewer PDF (spec, Phase 3 → Resume; ticket
 * 14): the page they were on and their zoom, one of the reader's 75, 100, 125
 * and 150 (src/lib/reviewer-pdfs/reader.ts), one row per Member and Reviewer
 * PDF, replaced as they read. Deleting the Reviewer PDF or the Member deletes
 * it; the index on reviewer_pdf_id serves that cascade.
 */
export const readerPositions = pgTable(
  "reader_positions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    reviewerPdfId: uuid("reviewer_pdf_id")
      .notNull()
      .references(() => reviewerPdfs.id, { onDelete: "cascade" }),
    page: integer("page").notNull(),
    zoom: smallint("zoom").notNull(),
    savedAt: at("saved_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.reviewerPdfId] }),
    index("reader_positions_reviewer_pdf_id_idx").on(t.reviewerPdfId),
    check("reader_positions_page_positive", sql`${t.page} > 0`),
    check("reader_positions_zoom_step", sql`${t.zoom} in (${sql.raw(READER_ZOOMS.join(", "))})`),
  ],
).enableRLS();

// ── Access Passes ───────────────────────────────────────────────────────────

/**
 * The Access Passes (ADR 0010): one per Member and Exam, active while
 * `ends_at` is later than now. `user_id` is the Member's User id, with no
 * foreign key to members, so a pass can wait for its holder's first sign-in
 * (the sample data's passes do); deleting an account deletes its passes with
 * it (ticket 19). Deleting the Exam deletes its passes.
 */
export const accessPasses = pgTable(
  "access_passes",
  {
    userId: uuid("user_id").notNull(),
    examCode: text("exam_code")
      .notNull()
      .references(() => exams.code, { onDelete: "cascade", onUpdate: "cascade" }),
    endsAt: at("ends_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.examCode] }),
    index("access_passes_exam_code_idx").on(t.examCode),
  ],
).enableRLS();

/**
 * Each Access Pass's history: every grant, extension and Paid Order that made
 * or extended it, in order (`seq`), each as the segment of days it added
 * (`starts_at` to `ends_at`), with who granted it as they were then. A row
 * with an `order_id` holds paid days: the Order's, recorded once (the unique
 * index), under the system actor "PayMongo (system)" with the reason "Order
 * AYC-…"; a row without one holds granted days (Phase 4, ticket 03; tickets
 * 09 and 10 tell them apart). Deleting the pass deletes its history.
 */
export const accessPassGrants = pgTable(
  "access_pass_grants",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id").notNull(),
    examCode: text("exam_code").notNull(),
    days: integer("days").notNull(),
    startsAt: at("starts_at").notNull(),
    endsAt: at("ends_at").notNull(),
    reason: text("reason").notNull(),
    grantedByEmail: text("granted_by_email").notNull(),
    grantedByName: text("granted_by_name").notNull(),
    grantedAt: at("granted_at").notNull(),
    // The Paid Order whose days these are; null for a grant or an extension.
    orderId: uuid("order_id").references((): AnyPgColumn => orders.id),
  },
  (t) => [
    foreignKey({
      name: "access_pass_grants_pass_fk",
      columns: [t.userId, t.examCode],
      foreignColumns: [accessPasses.userId, accessPasses.examCode],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("access_pass_grants_user_id_exam_code_seq_idx").on(t.userId, t.examCode, t.seq),
    uniqueIndex("access_pass_grants_order_id_idx").on(t.orderId),
    check("access_pass_grants_days_range", sql`${t.days} between 1 and 365`),
    check("access_pass_grants_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
    check("access_pass_grants_reason_present", sql`btrim(${t.reason}) <> ''`),
  ],
).enableRLS();

// ── Plans ───────────────────────────────────────────────────────────────────

/**
 * The Plans for sale in the Member App (Phase 4, ticket 01; spec, Phase 4 →
 * Plans): all of one Exam's content (ADR 0010) for 30, 90, 180 or 365 days,
 * at a price in centavos, whole pesos from ₱1 to ₱99,999. At most one per
 * Exam is Best value and at most one per Exam and duration is on sale (the
 * partial unique indexes); one that's off is hidden from Members. `saved_at`
 * and `saved_by` are its last save, for the conflict check. Deleting the Exam
 * deletes its Plans. The starting Plans go in switched off on the live
 * database (the starting-plans migration); a local load adds them on sale.
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey(),
    examCode: text("exam_code")
      .notNull()
      .references(() => exams.code, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text("name").notNull(),
    days: integer("days").notNull(),
    priceCentavos: integer("price_centavos").notNull(),
    bestValue: boolean("best_value").notNull().default(false),
    onSale: boolean("on_sale").notNull().default(false),
    savedAt: at("saved_at").notNull(),
    savedBy: text("saved_by"),
  },
  (t) => [
    index("plans_exam_code_idx").on(t.examCode),
    uniqueIndex("plans_one_best_value_per_exam_idx")
      .on(t.examCode)
      .where(sql`${t.bestValue}`),
    uniqueIndex("plans_one_on_sale_per_exam_and_days_idx")
      .on(t.examCode, t.days)
      .where(sql`${t.onSale}`),
    check("plans_days", sql`${t.days} in (30, 90, 180, 365)`),
    check(
      "plans_price_whole_pesos",
      sql`${t.priceCentavos} between 100 and 9999900 and ${t.priceCentavos} % 100 = 0`,
    ),
    check("plans_name_present", sql`btrim(${t.name}) <> '' and char_length(${t.name}) <= 80`),
  ],
).enableRLS();

// ── Orders ──────────────────────────────────────────────────────────────────

/** The Orders' references count up from here: "AYC-10001" first. Gaps are fine. */
export const orderReferenceSeq = pgSequence("order_reference_seq", {
  startWith: FIRST_REFERENCE_NUMBER,
});

export const orderStatus = pgEnum("order_status", ORDER_STATUSES);
export const paymentMethod = pgEnum("payment_method", PAYMENT_METHODS);

/**
 * The Orders (Phase 4, ticket 03; spec, Phase 4 → Order ledger, References;
 * CONTEXT.md → Order): one Member's attempt to buy one Plan, made Pending at
 * every Pay click. The Plan's name, days and price are copied at Pay, so a
 * later change to the Plan never touches the Order. `reference` comes from
 * order_reference_seq ("AYC-10001" upward, unique; test and live Orders share
 * it). `livemode` is PayMongo's (false for a Test Order and with the payments
 * fake); the checkout and payment ids are PayMongo's (null with the fake).
 * The buyer's name and email are kept as at Pay, and `user_id` empties when
 * the account is deleted, so an Order outlives it (ticket 14). A Plan that has
 * had an Order can't be deleted (the restrict). `paid_at` is set once the
 * Order has been Paid. The order ledger (src/lib/payments/order-ledger.ts)
 * moves the status.
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey(),
    reference: text("reference")
      .notNull()
      .unique("orders_reference_unique")
      .default(sql`('AYC-' || nextval('order_reference_seq'))`),
    // Null once the Member's account is deleted.
    userId: uuid("user_id").references(() => members.userId, { onDelete: "set null" }),
    examCode: text("exam_code")
      .notNull()
      .references(() => exams.code, { onDelete: "restrict", onUpdate: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    planName: text("plan_name").notNull(),
    days: integer("days").notNull(),
    priceCentavos: integer("price_centavos").notNull(),
    method: paymentMethod("method").notNull(),
    status: orderStatus("status").notNull(),
    livemode: boolean("livemode").notNull(),
    checkoutId: text("checkout_id"),
    paymentId: text("payment_id"),
    buyerName: text("buyer_name"),
    buyerEmail: text("buyer_email").notNull(),
    createdAt: at("created_at").notNull(),
    paidAt: at("paid_at"),
    statusChangedAt: at("status_changed_at").notNull(),
    // When the status-check backup last asked PayMongo (ticket 04): at most
    // once every 10 seconds per Order, claimed with one conditional update.
    statusCheckedAt: at("status_checked_at"),
    // The Orders admin's internal note, which only Staff see (ticket 07);
    // null for none. Its stamp is the record "order-note:<id>" (record_stamps).
    internalNote: text("internal_note"),
  },
  (t) => [
    index("orders_user_id_idx").on(t.userId),
    index("orders_plan_id_idx").on(t.planId),
    uniqueIndex("orders_checkout_id_idx")
      .on(t.checkoutId)
      .where(sql`${t.checkoutId} is not null`),
    check("orders_reference_format", sql`${t.reference} ~ '^AYC-[0-9]{5,}$'`),
    check("orders_days", sql`${t.days} in (30, 90, 180, 365)`),
    check(
      "orders_price_whole_pesos",
      sql`${t.priceCentavos} between 100 and 9999900 and ${t.priceCentavos} % 100 = 0`,
    ),
    check(
      "orders_paid_at_once_paid",
      sql`(${t.status} in ('paid', 'refunded')) = (${t.paidAt} is not null)`,
    ),
  ],
).enableRLS();

/**
 * The PayMongo webhook events already applied (Phase 4, ticket 05): one row
 * per event id, written in the same transaction as what the event changed,
 * so a repeat delivery changes nothing. `order_id` is the Order it was about,
 * or null for none of ours; it outlives the Order (set null).
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    eventId: text("event_id").primaryKey(),
    type: text("type").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    receivedAt: at("received_at").notNull(),
  },
  (t) => [index("payment_events_order_id_idx").on(t.orderId)],
).enableRLS();

// ── In-app notices ──────────────────────────────────────────────────────────

export const memberNoticeKind = pgEnum("member_notice_kind", NOTICE_KINDS);

/**
 * Each Member's in-app notices (ticket 17; spec, Phase 3 planning decisions →
 * In-app notices): one per grant, extension or end of an Access Pass, in the
 * order made (`seq`), shown as a dismissible banner until `dismissed_at` is
 * set. `ends_at` is the pass's end after the change. Deleting the Member or
 * the Exam deletes their notices. No email is sent.
 */
export const memberNotices = pgTable(
  "member_notices",
  {
    id: uuid("id").primaryKey(),
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => members.userId, { onDelete: "cascade" }),
    examCode: text("exam_code")
      .notNull()
      .references(() => exams.code, { onDelete: "cascade", onUpdate: "cascade" }),
    kind: memberNoticeKind("kind").notNull(),
    endsAt: at("ends_at").notNull(),
    createdAt: at("created_at").notNull(),
    dismissedAt: at("dismissed_at"),
  },
  (t) => [
    index("member_notices_user_id_seq_idx").on(t.userId, t.seq),
    index("member_notices_exam_code_idx").on(t.examCode),
  ],
).enableRLS();

// ── Privacy Requests ────────────────────────────────────────────────────────

export const privacyRequestType = pgEnum("privacy_request_type", PRIVACY_REQUEST_TYPES);
export const privacyRequestStatus = pgEnum("privacy_request_status", PRIVACY_REQUEST_STATUSES);

/**
 * Each Member's Privacy Requests (ticket 18; spec, Phase 3 → Privacy
 * Requests): a data copy or a deletion, asked for from Account, open until an
 * Owner marks it done (ticket 19), with when and by whom, as they were then.
 * `due_on` is the Manila date it's due (7 days for a copy, 30 for a
 * deletion), fixed when it's made. A Member has at
 * most one open request of each type: the partial unique index refuses a
 * second. A request outlives the account it's about: deleting the Member
 * empties `user_id`, so the request keeps its type, dates and status, the
 * record that it was carried out, and nothing that says who asked. A deletion
 * keeps the opaque User id it removed in `deleted_user_id`, so a Supabase User
 * left behind by a failed step can be deleted again (ticket 19). Nothing is
 * emailed.
 */
export const privacyRequests = pgTable(
  "privacy_requests",
  {
    id: uuid("id").primaryKey(),
    // Null once the Member's account is deleted.
    userId: uuid("user_id").references(() => members.userId, { onDelete: "set null" }),
    type: privacyRequestType("type").notNull(),
    status: privacyRequestStatus("status").notNull(),
    requestedAt: at("requested_at").notNull(),
    dueOn: date("due_on").notNull(),
    // Set together when an Owner marks it done (ticket 19).
    doneAt: at("done_at"),
    doneByEmail: text("done_by_email"),
    doneByName: text("done_by_name"),
    // The User id a deletion removed the Member data of. No foreign key: the Member is gone.
    deletedUserId: uuid("deleted_user_id"),
  },
  (t) => [
    index("privacy_requests_user_id_idx").on(t.userId),
    uniqueIndex("privacy_requests_one_open_per_type_idx")
      .on(t.userId, t.type)
      .where(sql`${t.status} = 'open'`),
    check(
      "privacy_requests_done_when_and_by_whom",
      sql`(${t.status} = 'open' and ${t.doneAt} is null and ${t.doneByEmail} is null and ${t.doneByName} is null)
        or (${t.status} = 'done' and ${t.doneAt} is not null and ${t.doneByEmail} is not null and ${t.doneByName} is not null)`,
    ),
  ],
).enableRLS();
