// The Admin seam's types (CONVENTIONS §3). Every Admin read and write goes
// through src/services/admin.ts; these are its inputs and outputs.

import type {
  Marketplace,
  Product,
  ProductFormat,
  ProductPhoto,
  ProductState,
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
