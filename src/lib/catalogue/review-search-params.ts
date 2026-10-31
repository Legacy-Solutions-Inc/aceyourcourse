import "server-only";

import { z } from "zod";

import {
  DEFAULT_REVIEW_SORT,
  MAX_REVIEW_QUERY_LENGTH,
  REVIEW_SORTS,
  type ReviewsQuery,
  STAR_BUCKETS,
} from "@/lib/catalogue/review-filters";

// Reading the review wall's filters from the Reviews URL. Server-only, so zod
// and the schemas stay out of the client bundle; the wall's filters write URLs
// with reviewsHref.

/** What a URL value is checked against. */
export interface ReviewSearchContext {
  /** The Products a Visitor can filter by. */
  productSlugs: string[];
  /** The Exams a Visitor can filter by. */
  examCodes: string[];
}

type SearchParams = Record<string, string | string[] | undefined>;

const starsSchema = z.enum(STAR_BUCKETS);
const sortSchema = z.enum(REVIEW_SORTS);
const querySchema = z
  .string()
  .trim()
  .min(1)
  .transform((query) => query.slice(0, MAX_REVIEW_QUERY_LENGTH).trim());

/**
 * Pure: the wall's filters in a Reviews URL's search params. Each value is
 * checked on its own, and one that isn't valid is ignored, never thrown:
 * - `product`: a Product slug from the context, exactly
 * - `exam`: an Exam code from the context, in any case
 * - `stars`: 5, 4 or 3-or-less
 * - `q`: trimmed, at most 100 characters
 * - `sort`: one of the wall's sorts (the default is left out)
 */
export function parseReviewSearchParams(
  params: SearchParams,
  { productSlugs, examCodes }: ReviewSearchContext,
): ReviewsQuery {
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const filters: ReviewsQuery = {};

  const product = value("product");
  if (product && productSlugs.includes(product)) filters.productSlug = product;

  const exam = value("exam")?.toLowerCase();
  const examCode = examCodes.find((code) => code.toLowerCase() === exam);
  if (examCode) filters.examCode = examCode;

  const stars = starsSchema.safeParse(value("stars"));
  if (stars.success) filters.stars = stars.data;

  const query = querySchema.safeParse(value("q"));
  if (query.success) filters.query = query.data;

  const sort = sortSchema.safeParse(value("sort"));
  if (sort.success && sort.data !== DEFAULT_REVIEW_SORT) filters.sort = sort.data;

  return filters;
}
