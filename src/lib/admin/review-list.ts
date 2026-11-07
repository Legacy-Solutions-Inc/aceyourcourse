import { MARKETPLACES } from "@/content/website";
import { MAX_QUERY_LENGTH } from "@/lib/catalogue/product-filters";
import { paths } from "@/paths";
import type {
  AdminReviewList,
  AdminReviewRow,
  ReviewListQuery,
  ReviewStarsFilter,
} from "@/services/admin.types";

// The Reviews & FAQs screen's URL and the Reviews list's labels (BUILD-MAP
// §3.4, REVIEWS tab). The filters live in the URL, so a reload keeps them:
// ?q=glossy&exam=ce&stars=5&pinned=1, with the selected Review as
// ?review=<id> or ?review=new, and the FAQS tab as ?tab=faqs (CONVENTIONS §2).
// The seam checks the Exam against the catalogue.

type SearchParams = Record<string, string | string[] | undefined>;

/** The screen's two tabs. */
export type ReviewsTab = "reviews" | "faqs";

/** How many pinned Reviews Home shows (spec, Phase 2 → Reviews). */
export const HOME_REVIEWS = 9;

/** The star chips' URL values: "3" is 3★ and below. */
const STARS_IN_URL: Record<string, ReviewStarsFilter> = { "5": "5", "4": "4", "3": "3-or-less" };
const STARS_TO_URL: Record<ReviewStarsFilter, string> = { "5": "5", "4": "4", "3-or-less": "3" };

/** Pure: the screen's tab, the Reviews list's filters and the selected Review in its URL. */
export function parseReviewListParams(params: SearchParams): {
  tab: ReviewsTab;
  query: ReviewListQuery;
  review: string | null;
} {
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
  };
  const query: ReviewListQuery = {};
  const q = value("q");
  if (q) query.q = q.slice(0, MAX_QUERY_LENGTH);
  const exam = value("exam");
  if (exam) query.exam = exam.slice(0, MAX_QUERY_LENGTH);
  const stars = STARS_IN_URL[value("stars") ?? ""];
  if (stars) query.stars = stars;
  if (value("pinned") === "1") query.pinned = true;
  return {
    tab: value("tab") === "faqs" ? "faqs" : "reviews",
    query,
    review: value("review")?.slice(0, MAX_QUERY_LENGTH) ?? null,
  };
}

/** Pure: a tab's URL, with no filters or selection. */
export const reviewsTabHref = (tab: ReviewsTab) =>
  tab === "faqs" ? `${paths.admin.reviews}?tab=faqs` : paths.admin.reviews;

/** Pure: the REVIEWS tab's URL for these filters and selected Review. */
export function reviewListHref(
  { q, exam, stars, pinned }: AdminReviewList["query"],
  review: string | null = null,
): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (exam) params.set("exam", exam.toLowerCase());
  if (stars) params.set("stars", STARS_TO_URL[stars]);
  if (pinned) params.set("pinned", "1");
  if (review) params.set("review", review);
  const search = params.toString();
  return search ? `${paths.admin.reviews}?${search}` : paths.admin.reviews;
}

/**
 * Pure: a row's meta line (mockup 1150): "CE · ULTIMATE CE POSTERS 2.0 ·
 * MSTC, HPGE, PSAD · SHOPEE · 19 HELPFUL", with the Review's own Marketplace
 * (BUILD-MAP §9 item 10), leaving out what it doesn't have.
 */
export function reviewMeta({ review, product }: AdminReviewRow): string {
  const marketplace =
    MARKETPLACES.find((m) => m.id === review.marketplace)?.name ?? review.marketplace;
  return [
    product.examCode,
    product.shortName,
    review.variation,
    marketplace,
    review.helpful > 0 ? `${review.helpful} HELPFUL` : null,
  ]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();
}

/** Pure: "N OF 9 PINNED ON HOME", a warning above 9 (mockup 1154). */
export function pinnedOnHomeLine(pinned: number): { text: string; over: boolean } {
  const over = pinned > HOME_REVIEWS;
  const text = `${pinned} OF ${HOME_REVIEWS} PINNED ON HOME`;
  return { text: over ? `${text} · HOME SHOWS THE FIRST ${HOME_REVIEWS}` : text, over };
}

/**
 * Pure: a Review's first six words, on one line, in quotes, to name it in a
 * control's label: "Pin on Home: “Glossy type yung paper, makapal sya. Malalaki…”".
 */
export function reviewName(text: string): string {
  const words = text.trim().split(/\s+/);
  const start = words.slice(0, 6).join(" ");
  return `“${words.length > 6 ? `${start}…` : start}”`;
}
