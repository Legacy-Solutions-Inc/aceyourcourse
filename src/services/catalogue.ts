import { unstable_cache } from "next/cache";

import { adminMode } from "@/lib/admin/mode";
import * as mockImpl from "@/services/catalogue.mock";
import { CATALOGUE_TAG, CATALOGUE_TAGS, type CatalogueAreaTag } from "@/services/catalogue.tags";
import type {
  Exam,
  ExamPageContent,
  FaqGroupWithItems,
  Product,
  ProductFilters,
  ReviewFilters,
  ReviewWithProduct,
  WebsiteSettings,
} from "@/services/catalogue.types";
import { getSampleStore } from "@/services/mock/sample-store";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue Service Seam. Every Website page and component reads Exams,
// Products, Reviews, FAQs and Website settings from here, and never imports
// the seed. This module is a thin SELECTOR, the pattern every seam copies.
// Phase 1 has only the in-memory mock arm. Phase 2 adds the Drizzle arm
// (catalogue.db.ts, chosen when a DATABASE_URL is configured) with no page
// changes. See docs/adr/0003 and docs/adr/0006.
//
// Every page renders per request (the CSP nonce), so speed comes from here:
// each read is cached once, tagged with the areas it reads (catalogue.tags.ts),
// and an Admin save clears the tags it affects (spec, Phase 1 → Rendering and
// caching).
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
   * The Exam's page: which sections show, its SEO overrides, share image and
   * Official Exam Date, and its bundle offer with the Product, only while that
   * Product is Live and on the Website. An Exam without a record shows every
   * section and sets nothing. Case-insensitive; null like getExamByCode.
   */
  getExamPage(code: string): Promise<ExamPageContent | null>;

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

  /**
   * The FAQ page: its groups in their fixed order, each with its FAQs in
   * order. Only FAQs with "Show on FAQ page" on are listed, and those that
   * need the Member App only while the switch is on. Empty groups are
   * dropped. A quote whose Review isn't shown on the Website is dropped.
   */
  listFaqs(): Promise<FaqGroupWithItems[]>;

  getWebsiteSettings(): Promise<WebsiteSettings>;
}

const impl: CatalogueService = mockImpl;

/**
 * What the cache keys hold besides each read's arguments. The sample data
 * starts again on every boot and Reset, with a new generation, so nothing
 * cached before a restart (the dev server keeps its cache on disk) is served
 * after it. With the Admin closed, the data is the seed and never changes.
 */
const dataVersion = (): string => (adminMode === "sample" ? getSampleStore().generation : "seed");

/** A read, cached under its name and arguments, with CATALOGUE_TAG and its areas' tags. */
function cached<Args extends unknown[], Result>(
  name: string,
  read: (...args: Args) => Promise<Result>,
  areas: readonly CatalogueAreaTag[],
): (...args: Args) => Promise<Result> {
  const cachedRead = unstable_cache(
    (_version: string, ...args: Args) => read(...args),
    [CATALOGUE_TAG, name],
    { tags: [CATALOGUE_TAG, ...areas] },
  );
  return (...args) => cachedRead(dataVersion(), ...args);
}

const { exams, products, reviews, faqs, settings, examPages } = CATALOGUE_TAGS;

// Each read is tagged with every area its answer depends on: listExams, for
// example, lists only the Exams with a Product on the Website.
export const listExams = cached("listExams", impl.listExams, [exams, products]);
export const getExamByCode = cached("getExamByCode", impl.getExamByCode, [exams]);
// The page record's Exam is only matched by its fixed code, so the exams tag isn't needed.
export const getExamPage = cached("getExamPage", impl.getExamPage, [examPages, products]);
export const listProducts = cached("listProducts", impl.listProducts, [products, exams]);
export const getProductBySlug = cached("getProductBySlug", impl.getProductBySlug, [products]);
export const listRelatedProducts = cached("listRelatedProducts", impl.listRelatedProducts, [
  products,
]);
export const listBestSellers = cached("listBestSellers", impl.listBestSellers, [products]);
export const listReviews = cached("listReviews", impl.listReviews, [reviews, products]);
export const listHomeReviews = cached("listHomeReviews", impl.listHomeReviews, [reviews, products]);
export const listFaqs = cached("listFaqs", impl.listFaqs, [faqs, reviews, products]);
export const getWebsiteSettings = cached("getWebsiteSettings", impl.getWebsiteSettings, [settings]);
