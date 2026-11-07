import { paths } from "@/paths";
import type { Product, ProductFormat, ProductSort } from "@/services/catalogue.types";

// The Products page filters on the client and the server: their URL, the price
// slider's bounds and the chip counts. Reading them from a URL is server-side,
// in product-search-params.ts.

/** The formats in the order the Products page lists them. */
export const PRODUCT_FORMATS = [
  "flash-cards",
  "posters",
  "notebook",
  "bundle",
] as const satisfies readonly ProductFormat[];

/** The sorts in the order the Products page lists them. */
export const PRODUCT_SORTS = [
  "best-selling",
  "price-asc",
  "price-desc",
  "top-rated",
] as const satisfies readonly ProductSort[];

/** The sort a Products URL without `sort` has. */
export const DEFAULT_SORT: ProductSort = "best-selling";
/** The longest search the Products page keeps. */
export const MAX_QUERY_LENGTH = 100;
/** The price slider's step, in whole pesos. */
export const PRICE_STEP = 50;

/** The Products page filters, as they appear in its URL. */
export interface ProductsQuery {
  exam?: string;
  format?: ProductFormat;
  q?: string;
  sort?: ProductSort;
  /** Whole pesos. */
  max?: number;
  app?: boolean;
}

/**
 * Pure: a link to the Products page with these filters. Keys are written in a
 * fixed order and defaults are left out, so each filter set has one URL:
 * `productsHref({})` is "/products".
 */
export function productsHref(query: ProductsQuery): string {
  const params = new URLSearchParams();
  if (query.exam) params.set("exam", query.exam.toLowerCase());
  if (query.format) params.set("format", query.format);
  const q = query.q?.trim();
  if (q) params.set("q", q);
  if (query.sort && query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  if (query.max !== undefined) params.set("max", String(query.max));
  if (query.app) params.set("app", "1");
  const search = params.toString();
  return search ? `${paths.products.list}?${search}` : paths.products.list;
}

/** Whole pesos: the cheapest and the dearest Live Product, on the price slider's ₱50 steps. */
export interface PriceBounds {
  min: number;
  max: number;
}

const livePrices = (products: Product[]) =>
  products.flatMap((p) => (p.state === "live" && p.priceFrom !== null ? [p.priceFrom / 100] : []));

/**
 * Pure: the price slider's range in whole pesos. The lowest Live price is
 * rounded down and the highest up to a ₱50 step. Coming Soon Products have no
 * price, so they never count. With no Live Products it is 0 to 0.
 */
export function priceBoundsOf(products: Product[]): PriceBounds {
  const prices = livePrices(products);
  if (prices.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP,
    max: Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP,
  };
}

/** The numbers on the Products page's filter chips. */
export interface FacetCounts {
  /** Every Live Product. */
  all: number;
  /** Live Products per Exam code, over every Exam. An Exam with none is left out. */
  exams: Record<string, number>;
  /** Live Products per format, within the selected Exam (or every Exam). */
  formats: Record<ProductFormat, number>;
}

/**
 * Pure: the filter chip counts. The Exam chips count every Live Product, so
 * they don't change as Exams are picked; the format chips count within the
 * selected Exam. Coming Soon Products never count.
 */
export function facetCounts(products: Product[], selectedExam?: string): FacetCounts {
  const live = products.filter((p) => p.state === "live");
  const exam = selectedExam?.toUpperCase();
  const exams: Record<string, number> = {};
  const formats: Record<ProductFormat, number> = {
    "flash-cards": 0,
    posters: 0,
    notebook: 0,
    bundle: 0,
  };
  for (const product of live) {
    exams[product.examCode] = (exams[product.examCode] ?? 0) + 1;
    if (!exam || product.examCode === exam) formats[product.format] += 1;
  }
  return { all: live.length, exams, formats };
}
