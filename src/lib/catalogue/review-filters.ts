import { paths } from "@/paths";
import type { ReviewFilters, ReviewSort, ReviewWithProduct } from "@/services/catalogue.types";

// The Reviews page wall's filters on the client and the server: their URL and
// the chip counts. Reading them from a URL is server-side, in
// review-search-params.ts.

/** The star chips' buckets, in the order the wall lists them. */
export const STAR_BUCKETS = ["5", "4", "3-or-less"] as const satisfies readonly NonNullable<
  ReviewFilters["stars"]
>[];
export type StarBucket = (typeof STAR_BUCKETS)[number];

/** The wall's sorts, in the order it lists them. The Exam page's own sort isn't one. */
export const REVIEW_SORTS = [
  "most-helpful",
  "highest",
  "most-critical",
  "most-detailed",
] as const satisfies readonly ReviewSort[];
export type ReviewWallSort = (typeof REVIEW_SORTS)[number];

/** The sort a Reviews URL without `sort` has. */
export const DEFAULT_REVIEW_SORT: ReviewWallSort = "most-helpful";
/** The longest search the wall keeps. */
export const MAX_REVIEW_QUERY_LENGTH = 100;

/** The filters a Reviews URL carries, in the shape the seam's listReviews takes. */
export interface ReviewsQuery {
  productSlug?: string;
  examCode?: string;
  stars?: StarBucket;
  query?: string;
  sort?: ReviewWallSort;
}

/**
 * Pure: a link to the Reviews page with these filters. Keys are written in a
 * fixed order (product, exam, stars, q, sort) and defaults are left out, so
 * each filter set has one URL: `reviewsHref({})` is "/reviews".
 */
export function reviewsHref(filters: ReviewsQuery): string {
  const params = new URLSearchParams();
  if (filters.productSlug) params.set("product", filters.productSlug);
  if (filters.examCode) params.set("exam", filters.examCode.toLowerCase());
  if (filters.stars) params.set("stars", filters.stars);
  const query = filters.query?.trim();
  if (query) params.set("q", query);
  if (filters.sort && filters.sort !== DEFAULT_REVIEW_SORT) params.set("sort", filters.sort);
  const search = params.toString();
  return search ? `${paths.reviews}?${search}` : paths.reviews;
}

/** The numbers on the wall's filter chips. */
export interface ReviewFacetCounts {
  /** Every written Review. */
  all: number;
  /** Reviews per Exam code. An Exam with none is left out. */
  exams: Record<string, number>;
  stars: Record<StarBucket, number>;
}

const bucketOf = (stars: ReviewWithProduct["stars"]): StarBucket =>
  stars === 5 ? "5" : stars === 4 ? "4" : "3-or-less";

/**
 * Pure: the chip counts over every written Review, so they don't change as
 * filters are picked (the Products page's Exam chips work the same way).
 */
export function reviewFacetCounts(reviews: ReviewWithProduct[]): ReviewFacetCounts {
  const exams: Record<string, number> = {};
  const stars: Record<StarBucket, number> = { "5": 0, "4": 0, "3-or-less": 0 };
  for (const review of reviews) {
    const { examCode } = review.product;
    exams[examCode] = (exams[examCode] ?? 0) + 1;
    stars[bucketOf(review.stars)] += 1;
  }
  return { all: reviews.length, exams, stars };
}
