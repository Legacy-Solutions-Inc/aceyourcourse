// ─────────────────────────────────────────────────────────────────────────────
// Catalogue Service Seam types. The mock (Phase 1) and the database (Phase 2)
// implementations both return these shapes, so pages never change when the
// data source does. Vocabulary follows CONTEXT.md. Products and Reviews arrive
// with ticket 02.
// ─────────────────────────────────────────────────────────────────────────────

/** An external store where Products are sold. */
export type Marketplace = "shopee" | "lazada" | "tiktok";

/** One of an Exam's official board subjects, e.g. MSTC under CE. */
export interface Subject {
  code: string;
  name: string;
}

/** A Philippine licensure exam that AYC makes study material for. */
export interface Exam {
  /** Uppercase code, e.g. "CE". URLs use it lowercased. */
  code: string;
  /** Board acronym, e.g. "CELE". */
  board: string;
  name: string;
  longName: string;
  blurb: string;
  madeFor: string;
  subjects: Subject[];
}

export interface AnnouncementMessage {
  text: string;
  href: string;
  /** Shown only while the Member App switch is on. */
  requiresMemberApp: boolean;
}

export interface PromoBanner {
  visible: boolean;
  text: string;
  buttonLabel: string;
  href: string;
  /** ISO date; the banner runs from the start of this Asia/Manila day. */
  startDate: string;
  /** ISO date; the banner runs to the end of this Asia/Manila day. */
  endDate: string;
}

/** Shop-wide Shopee figures, entered by hand. */
export interface ShopStats {
  rating: number;
  ratingCount: number;
  followers: string;
  /** ISO date the figures were copied from Shopee. */
  asOf: string;
}

export interface SocialLinks {
  tiktok: string | null;
  facebook: string | null;
  instagram: string | null;
}

export interface WebsiteSettings {
  /** Each Marketplace's shop page. `null` hides that Marketplace's shop link. */
  shopLinks: Record<Marketplace, string | null>;
  /** `null` hides that social link. */
  socialLinks: SocialLinks;
  contactEmail: string;
  shopStats: ShopStats;
  /** Changing `id` shows the bar again to Visitors who dismissed it. */
  announcement: { id: string; messages: AnnouncementMessage[] };
  promoBanner: PromoBanner | null;
  /** The Member App switch. While false, no Member App link or message renders. */
  memberAppLive: boolean;
}
