import { paths } from "@/paths";
import type { ProductFormat, ProductSort } from "@/services/catalogue.types";

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
  if (query.sort && query.sort !== "best-selling") params.set("sort", query.sort);
  if (query.max !== undefined) params.set("max", String(query.max));
  if (query.app) params.set("app", "1");
  const search = params.toString();
  return search ? `${paths.products.list}?${search}` : paths.products.list;
}
