import "server-only";

import { z } from "zod";

import {
  DEFAULT_SORT,
  MAX_QUERY_LENGTH,
  type PriceBounds,
  PRODUCT_FORMATS,
  PRODUCT_SORTS,
  type ProductsQuery,
} from "@/lib/catalogue/product-filters";
import type { ProductFilters } from "@/services/catalogue.types";

// Reading the Products page filters from its URL. Server-only, so zod and the
// schemas stay out of the client bundle; the filter bar writes URLs with
// productsHref.

/** The Products page filters, read for the seam, with the max price also in whole pesos. */
export type ParsedProductFilters = ProductFilters & { maxPesos?: number };

/** What a URL value is checked against. */
export interface ProductSearchContext {
  /** The Exams a Visitor can filter by. */
  examCodes: string[];
  /** The Member App switch. While it's off, app=1 is ignored. */
  memberAppLive: boolean;
  priceBounds: PriceBounds;
}

type SearchParams = Record<string, string | string[] | undefined>;

const formatSchema = z.enum(PRODUCT_FORMATS);
const sortSchema = z.enum(PRODUCT_SORTS);
const querySchema = z
  .string()
  .trim()
  .min(1)
  .transform((query) => query.slice(0, MAX_QUERY_LENGTH).trim());
const pesosSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((pesos) => Number(pesos));

/**
 * Pure: the Products page filters in a URL's search params. Each value is
 * checked on its own, and one that isn't valid is ignored, never thrown:
 * - `exam`: an Exam code from the context, in any case
 * - `format` and `sort`: one of the known values (the default sort is left out)
 * - `q`: trimmed, at most 100 characters
 * - `max`: whole pesos within the price bounds. At or above the top bound it
 *   means "Any", so it's left out.
 * - `app=1`: only while the Member App switch is on
 */
export function parseProductSearchParams(
  params: SearchParams,
  { examCodes, memberAppLive, priceBounds }: ProductSearchContext,
): ParsedProductFilters {
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const filters: ParsedProductFilters = {};

  const exam = value("exam")?.toLowerCase();
  const examCode = examCodes.find((code) => code.toLowerCase() === exam);
  if (examCode) filters.examCode = examCode;

  const format = formatSchema.safeParse(value("format"));
  if (format.success) filters.format = format.data;

  const query = querySchema.safeParse(value("q"));
  if (query.success) filters.query = query.data;

  const sort = sortSchema.safeParse(value("sort"));
  if (sort.success && sort.data !== DEFAULT_SORT) filters.sort = sort.data;

  const max = pesosSchema.safeParse(value("max"));
  if (max.success && max.data >= priceBounds.min && max.data < priceBounds.max) {
    filters.maxPesos = max.data;
    filters.maxPrice = max.data * 100;
  }

  if (memberAppLive && value("app") === "1") filters.availableInApp = true;

  return filters;
}

/** Pure: the URL form of parsed filters, for productsHref. */
export function productsQueryOf(filters: ParsedProductFilters): ProductsQuery {
  return {
    exam: filters.examCode,
    format: filters.format,
    q: filters.query,
    sort: filters.sort,
    max: filters.maxPesos,
    app: filters.availableInApp,
  };
}
