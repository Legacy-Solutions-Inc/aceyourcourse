import * as mockImpl from "@/services/catalogue.mock";
import type {
  Exam,
  Product,
  ProductFilters,
  ReviewFilters,
  ReviewWithProduct,
  WebsiteSettings,
} from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue Service Seam. Every Website page and component reads Exams,
// Products, Reviews and Website settings from here, and never imports the
// seed. This module is a thin SELECTOR, built like src/services/customers.ts.
// Phase 1 has only the in-memory mock arm. Phase 2 adds the Drizzle arm
// (catalogue.db.ts, chosen when a DATABASE_URL is configured) with no page
// changes. See docs/adr/0003 and docs/adr/0006.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The seam's public contract. Each implementation is checked against it below,
 * so the mock and (from Phase 2) the database arm can never drift apart.
 */
interface CatalogueService {
  /**
   * The Exams with at least one Product shown on the Website (Live or Coming
   * Soon), with their Subjects, in seed order.
   */
  listExams(): Promise<Exam[]>;
  /** Case-insensitive. Null when the code is unknown or blank. Ignores Products. */
  getExamByCode(code: string): Promise<Exam | null>;

  /**
   * Products shown on the Website. `state` defaults to "live" and `sort` to
   * "best-selling". Coming Soon Products ignore `sort` and `maxPrice` and come
   * in Exam order, then by title. `total` counts every match.
   */
  listProducts(filters?: ProductFilters): Promise<{ items: Product[]; total: number }>;
  /** Null when the slug is unknown or the Product isn't shown on the Website. */
  getProductBySlug(slug: string): Promise<Product | null>;
  /**
   * Up to `limit` (default 3) other Live Products of the same Exam, by units
   * sold. With none, the best sellers from other Exams.
   */
  listRelatedProducts(
    product: Product,
    limit?: number,
  ): Promise<{ scope: "same-exam" | "other-exams"; items: Product[] }>;
  /** Live Products with Shopee figures, by units sold. */
  listBestSellers(limit: number): Promise<Product[]>;

  /**
   * Reviews of Live Products shown on the Website, most helpful first by
   * default. `limit` applies after sorting; `total` counts every match.
   */
  listReviews(filters?: ReviewFilters): Promise<{ items: ReviewWithProduct[]; total: number }>;
  /** The pinned Home selection in pin order, at most 9. */
  listHomeReviews(): Promise<ReviewWithProduct[]>;

  getWebsiteSettings(): Promise<WebsiteSettings>;
}

const impl: CatalogueService = mockImpl;

export const listExams = impl.listExams;
export const getExamByCode = impl.getExamByCode;
export const listProducts = impl.listProducts;
export const getProductBySlug = impl.getProductBySlug;
export const listRelatedProducts = impl.listRelatedProducts;
export const listBestSellers = impl.listBestSellers;
export const listReviews = impl.listReviews;
export const listHomeReviews = impl.listHomeReviews;
export const getWebsiteSettings = impl.getWebsiteSettings;
