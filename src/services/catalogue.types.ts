// ─────────────────────────────────────────────────────────────────────────────
// Catalogue Service Seam types. The mock (Phase 1) and the database (Phase 2)
// implementations both return these shapes, so pages never change when the
// data source does. Vocabulary follows CONTEXT.md. Money is in integer
// centavos (₱1,200 is 120000).
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

export type ProductFormat = "flash-cards" | "notebook" | "posters" | "bundle";

/** A Coming Soon Product is announced but not out: no price, not for sale. */
export type ProductState = "live" | "coming-soon";

export interface ProductVariation {
  /** As the Marketplace names it, e.g. "CE POSTERS 2.0: MSTC ONLY". */
  name: string;
  /** Centavos. */
  price: number;
}

export interface ProductPhoto {
  src: string;
  alt: string;
}

/** A Product's Shopee figures, entered by hand. */
export interface ShopeeFigures {
  rating: number;
  ratingCount: number;
  unitsSold: number;
  /** ISO date the figures were copied from Shopee. */
  asOf: string;
}

/** A physical study item sold on the Marketplaces. */
export interface Product {
  /** Stable identity, independent of the slug and any Marketplace id. */
  id: string;
  /** The readable URL part: /products/{slug}. */
  slug: string;
  examCode: string;
  title: string;
  shortName: string;
  format: ProductFormat;
  /** Size and paper, e.g. "4 × 6 in · 160 gsm". */
  size: string;
  edition: string | null;
  /** Codes of Subjects on the Product's Exam. */
  subjectCodes: string[];
  state: ProductState;
  /** Centavos. Null only for Coming Soon. */
  priceFrom: number | null;
  /** Centavos. Set when the Product is priced as a range. */
  priceTo: number | null;
  variations: ProductVariation[];
  /** In order; the first is the cover. */
  photos: ProductPhoto[];
  /** The Product's own Listing on each Marketplace, when it has one. */
  listings: Partial<Record<Marketplace, string>>;
  shopee: ShopeeFigures | null;
  /** Shopee's "any 2 enjoy 4% off" deal. */
  deal: boolean;
  availableInApp: boolean;
  showOnWebsite: boolean;
  /** Product page text. Null uses the generated default. */
  whatsInside: string | null;
  madeFor: string[] | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

/** A Marketplace buyer's review, curated and copied word for word. */
export interface Review {
  id: string;
  productId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  /** Line breaks are kept. */
  text: string;
  variation: string | null;
  /** How many buyers found it helpful on the Marketplace. */
  helpful: number;
  marketplace: Marketplace;
  /** Its place in the Home selection, or null when it isn't on Home. */
  homePin: number | null;
}

export interface ReviewWithProduct extends Review {
  product: { slug: string; shortName: string; examCode: string };
}

export type ProductSort = "best-selling" | "price-asc" | "price-desc" | "top-rated";

export interface ProductFilters {
  examCode?: string;
  format?: ProductFormat;
  query?: string;
  /** Centavos. Keeps Products whose priceFrom is at most this. */
  maxPrice?: number;
  availableInApp?: boolean;
  /** Defaults to "live". */
  state?: ProductState;
  /** Defaults to "best-selling". Ignored for Coming Soon. */
  sort?: ProductSort;
}

export type ReviewSort =
  "most-helpful" | "highest" | "most-critical" | "most-detailed" | "exam-page";

export interface ReviewFilters {
  productSlug?: string;
  examCode?: string;
  stars?: "5" | "4" | "3-or-less";
  query?: string;
  /** Defaults to "most-helpful". */
  sort?: ReviewSort;
  /** Applied after sorting. */
  limit?: number;
}
