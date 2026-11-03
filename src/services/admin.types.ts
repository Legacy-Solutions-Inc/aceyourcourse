// The Admin seam's types (CONVENTIONS §3). Every Admin read and write goes
// through src/services/admin.ts; these are its inputs and outputs.

import type {
  Exam,
  ExamPage,
  Faq,
  FaqGroup,
  Marketplace,
  Product,
  ProductFormat,
  ProductPhoto,
  ProductState,
  PromoBanner,
  Review,
  ShopStats,
  SocialLinks,
  WebsiteSettings,
} from "@/services/catalogue.types";

export type StaffRole = "owner" | "editor";

/** The signed-in Staff User a write acts as, from the Staff Guard. */
export type StaffActor = { email: string; name: string; role: StaffRole };

export type AdminError =
  | { kind: "invalid"; fieldErrors: Record<string, string[]>; formError?: string }
  | { kind: "conflict"; savedBy: string | null; savedAt: string }
  | { kind: "not-found" }
  | { kind: "forbidden"; message: string };

/** What every Admin write returns: the value and the cache tags to clear, or an error. */
export type AdminResult<T> =
  { ok: true; value: T; tags: string[] } | { ok: false; error: AdminError };

/** Who may make a write: any Staff User, or Owners only. */
export type RequiredRole = "staff" | "owner";

/**
 * When an editable record was last saved, and by whom. Editors hold `savedAt`
 * from when they opened, for the conflict check. `savedBy` is null for a record
 * nobody has saved in the Admin yet.
 */
export interface RecordStamp {
  /** ISO time of the last save. */
  savedAt: string;
  savedBy: string | null;
}

// ── Staff, Invites and sign-in ──────────────────────────────────────────────

/** An active place on the staff list. Emails are stored lowercase. */
export interface StaffMember {
  email: string;
  name: string;
  role: StaffRole;
  /** ISO time the User joined the staff list. */
  addedAt: string;
  /** ISO time of the last sign-in, or null when never recorded. */
  lastSignedInAt: string | null;
}

/** A pending place on the staff list. It expires 7 days after it was made or last renewed. */
export interface Invite {
  email: string;
  role: StaffRole;
  /** ISO time the Invite was made or last renewed. */
  createdAt: string;
  /** ISO time the Invite stops working. */
  expiresAt: string;
}

/** Who can use the Admin, as an Owner manages it in Settings. */
export interface StaffList {
  staff: StaffMember[];
  invites: Invite[];
}

/** Why a signed-in User was refused the Admin. */
export type DeniedReason = "not-staff" | "invite-expired";

/** Why the 403 screen shows: a refused User, or an Editor on an Owner-only screen. */
export type DeniedScreenReason = DeniedReason | "owners-only";

/** One recorded refused sign-in. */
export interface DeniedSignIn {
  id: string;
  email: string;
  reason: DeniedReason;
  /** ISO time of the attempt. */
  at: string;
}

/** The permanent record of one change made in the Admin. */
export interface StaffActivity {
  id: string;
  /** ISO time of the change. */
  at: string;
  actor: { email: string; name: string };
  entity: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
}

/** Who is signing in: their verified email, and their name when the sign-in gives one. */
export interface SignInIdentity {
  email: string;
  name: string | null;
}

/** The staff list's answer to a sign-in. */
export type SignInResolution =
  { status: "staff"; actor: StaffActor } | { status: "denied"; reason: DeniedReason };

// ── Settings ────────────────────────────────────────────────────────────────

/**
 * What an Owner edits in Settings. The announcement and the promo banner are
 * Website settings too, but they're edited on their own screen.
 */
export interface EditableWebsiteSettings {
  contactEmail: string;
  shopLinks: WebsiteSettings["shopLinks"];
  socialLinks: SocialLinks;
  shopStats: ShopStats;
}

/** Settings as the Admin reads them: the values, and when and by whom they were last saved. */
export interface AdminWebsiteSettings {
  values: EditableWebsiteSettings;
  stamp: RecordStamp;
}

// ── Products ────────────────────────────────────────────────────────────────

/**
 * Where a Product's store button for one Marketplace goes, as the Products
 * list's S/L/T badges show it: its own Listing ("product", green), that
 * Marketplace's shop page from Settings ("shop", amber), or nowhere, so the
 * Website hides the button ("none"). A Coming Soon Product has no store
 * buttons, so every Marketplace is "none".
 */
export type StoreLinkStatus = "product" | "shop" | "none";

/** One row of the Products list. */
export interface AdminProductRow {
  id: string;
  slug: string;
  title: string;
  shortName: string;
  examCode: string;
  format: ProductFormat;
  state: ProductState;
  /** Centavos. Null only for Coming Soon. */
  priceFrom: number | null;
  /** Centavos. Set when the Product is priced as a range. */
  priceTo: number | null;
  /** From the Shopee figures; null when it has none (Coming Soon). */
  unitsSold: number | null;
  /** The first photo, or null when it has none. */
  cover: ProductPhoto | null;
  storeLinks: Record<Marketplace, StoreLinkStatus>;
  showOnWebsite: boolean;
  availableInApp: boolean;
  stamp: RecordStamp;
}

/** The Products list's filters, as its URL gives them. Each one is optional. */
export interface ProductListQuery {
  /** Matched case-insensitively against the title and the short name. */
  q?: string;
  /** An Exam code, in any case. An unknown one is ignored. */
  exam?: string;
  /** Live Products with at least one Marketplace on its shop page. */
  missing?: boolean;
}

/** The Products list: the rows that match, and the filters as they were applied. */
export interface AdminProductList {
  /** Live Products by units sold, then by title; then Coming Soon, by title. */
  rows: AdminProductRow[];
  /** The filters applied: the search trimmed, an unknown Exam dropped. */
  query: { q: string | null; exam: string | null; missing: boolean };
  /** Every Exam code, in the catalogue's order, for the Exam chips. */
  examCodes: string[];
  /** How many Products the catalogue has, whatever the filters. */
  total: number;
}

/**
 * One Product as its editor opens it: every field the catalogue holds, its
 * stamp for the conflict check, and how many Reviews it has, since a Product
 * with Reviews can't be Coming Soon.
 */
export interface AdminProduct {
  product: Product;
  stamp: RecordStamp;
  reviewCount: number;
}

/** What goes with a Product when it's deleted, as the typed-DELETE dialog counts it. */
export interface ProductDeletePreview {
  reviews: number;
  photos: number;
  /** FAQ quotes taken from its Reviews, which are removed from their FAQs. */
  faqQuotes: number;
}

/** A deleted Product: what its delete removed. */
export interface DeletedProduct extends ProductDeletePreview {
  id: string;
  slug: string;
}

// ── Reviews ─────────────────────────────────────────────────────────────────

/** The Reviews list's star chips: 5★, 4★, or "3★ and below". */
export type ReviewStarsFilter = "5" | "4" | "3-or-less";

/** The Reviews list's filters, as its URL gives them. Each one is optional. */
export interface ReviewListQuery {
  /** Matched case-insensitively against the Review's text. */
  q?: string;
  /** An Exam code, in any case. An unknown one is ignored. */
  exam?: string;
  stars?: ReviewStarsFilter;
  /** "Pinned on Home only": the pinned Reviews, in the Home order. */
  pinned?: boolean;
}

/** One row of the Reviews list: the Review, and the Product it's for. */
export interface AdminReviewRow {
  review: Review;
  product: { shortName: string; examCode: string };
}

/** A Live Product a Review can be for, as the editor's PRODUCT select lists it. */
export interface ReviewProductOption {
  id: string;
  slug: string;
  examCode: string;
  shortName: string;
  /** Its variations as a buyer sees them ("MSTC ONLY"), for VARIATION BOUGHT. */
  variations: string[];
}

/** The Reviews list: the rows that match, the filters as applied, and the counters. */
export interface AdminReviewList {
  /** In the catalogue's order; with "Pinned on Home only", in the Home order. */
  rows: AdminReviewRow[];
  /** The filters applied: the search trimmed, an unknown Exam dropped. */
  query: {
    q: string | null;
    exam: string | null;
    stars: ReviewStarsFilter | null;
    pinned: boolean;
  };
  /** Every Exam code, in the catalogue's order, for the Exam chips. */
  examCodes: string[];
  /** How many Reviews the catalogue has, whatever the filters. */
  total: number;
  /** The Home order, first to last, whatever the filters, for ▲▼. */
  homeOrder: string[];
  /**
   * How many pinned Reviews Home can show, their Products shown on the
   * website: "N OF 9 PINNED ON HOME". Home shows the first 9 of them.
   */
  pinnedOnHome: number;
  /** The Live Products, in the catalogue's order, for the editor. */
  products: ReviewProductOption[];
}

/** One Review as its editor opens it, with its stamp for the conflict check. */
export interface AdminReview {
  review: Review;
  stamp: RecordStamp;
}

/** What goes with a Review when it's deleted. */
export interface ReviewDeletePreview {
  /** FAQ quotes taken from it, which are removed from their FAQs. */
  faqQuotes: number;
}

/** A deleted Review: what its delete removed. */
export interface DeletedReview extends ReviewDeletePreview {
  id: string;
}

// ── FAQs ────────────────────────────────────────────────────────────────────

/** The FAQS tab's selection, as its URL gives it. Each one is optional. */
export interface FaqListQuery {
  /** One of the 5 groups. Any other falls back to the first. */
  group?: string;
  /** Matched case-insensitively against every group's questions and answers. */
  q?: string;
}

/** One of the 5 fixed groups, with how many FAQs it has, hidden ones included. */
export interface FaqGroupCount {
  group: FaqGroup;
  title: string;
  count: number;
}

/** A Review an FAQ can quote: one shown on the Website, with its Product. */
export interface FaqReviewOption {
  id: string;
  stars: Review["stars"];
  text: string;
  product: { shortName: string; examCode: string };
}

/** The FAQS tab: the groups, the FAQs that match, and the editor's choices. */
export interface AdminFaqList {
  /** The 5 groups, in the FAQ page's order. */
  groups: FaqGroupCount[];
  /** The selection applied: the group checked, the search trimmed. */
  query: { group: FaqGroup; q: string | null };
  /**
   * The group's FAQs, in order; while searching, the matches in every group,
   * in the FAQ page's order. Hidden and app-only FAQs are included.
   */
  rows: Faq[];
  /** The Reviews a quote can come from, in the catalogue's order. */
  reviews: FaqReviewOption[];
  /** Every FAQ's deep-link slug, so a new FAQ's can be shown before it's added. */
  slugs: string[];
}

/** One FAQ as its editor opens it, with its stamp for the conflict check. */
export interface AdminFaq {
  faq: Faq;
  stamp: RecordStamp;
}

/** A deleted FAQ. */
export interface DeletedFaq {
  id: string;
}

// ── Exam pages ──────────────────────────────────────────────────────────────

/**
 * A part of an Exam page that its own editor saves, with its own stamp for
 * the conflict check. The section toggles always save, so theirs is never
 * checked.
 */
export type ExamPagePart =
  "header" | "subjects" | "sections" | "bundleOffer" | "seo" | "officialExamDate";

/** A Product a bundle offer can be of: one of the Exam's, Live or not, shown or not. */
export interface BundleProductOption {
  id: string;
  shortName: string;
  state: ProductState;
  showOnWebsite: boolean;
}

/** One Exam's page as its editors open it: the Exam, its page record, and each part's stamp. */
export interface AdminExamPage {
  exam: Exam;
  /** Its record, or the defaults while it has none. */
  page: ExamPage;
  stamps: Record<ExamPagePart, RecordStamp>;
  /** The Exam's Products, in the catalogue's order, for the bundle offer. */
  products: BundleProductOption[];
}

// ── Home promo banner and announcement bar ──────────────────────────────────

/** The Home promo banner as its editor opens it, with the stamp its Save checks. */
export interface AdminPromoBanner {
  /** null while the Website has none: the first Save makes it, turned off. */
  banner: PromoBanner | null;
  stamp: RecordStamp;
}

/** The announcement bar as its editor opens it, with the stamp its Save checks. */
export interface AdminAnnouncement {
  announcement: WebsiteSettings["announcement"];
  /** The Member App switch: while it's off, messages that need it don't show. */
  memberAppLive: boolean;
  stamp: RecordStamp;
}

// ── Overview ────────────────────────────────────────────────────────────────

/**
 * What the Overview works out what needs Staff from (src/lib/admin/needs-attention.ts):
 * every Product, hidden and Coming Soon ones included, the Exams and their
 * page records, and the settings it checks.
 */
export interface AdminOverview {
  products: Product[];
  exams: Exam[];
  /** Only the Exams that have one; the others have the defaults. */
  examPages: ExamPage[];
  settings: OverviewSettings;
}

/** The Website's settings the Overview checks: the shop pages, the trust figures and the promo banner. */
export type OverviewSettings = Pick<WebsiteSettings, "shopLinks" | "shopStats" | "promoBanner">;
