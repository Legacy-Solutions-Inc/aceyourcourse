import { aboutCopy } from "@/content/about";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import type { ShopStats } from "@/services/catalogue.types";

const copy = aboutCopy.stats;

export interface AboutStat {
  /** "rating" and "followers" are the shop's Shopee figures, with an "as of" date. */
  id: "products" | "exams" | "rating" | "followers";
  /** The big figure, e.g. "8", or "4.8" for the rating (the star is the page's, visual only). */
  value: string;
  /** What it counts, e.g. "reviewers". */
  label: string;
}

interface AboutStatsInput {
  /** The Live Products shown on the Website: listProducts().total. */
  productTotal: number;
  /** The Exams with a Product shown on the Website: listExams().length. */
  examCount: number;
  shopStats: ShopStats;
}

/**
 * Pure: the About hero's stat tiles, in place of the mockup's hardcoded "29
 * reviewers · 11 board exams". A tile whose figure is 0 or missing is left
 * out, so an empty catalogue never shows "0 reviewers".
 */
export function aboutStats({ productTotal, examCount, shopStats }: AboutStatsInput): AboutStat[] {
  const { rating, ratingCount } = shopStats;
  const followers = shopStats.followers.trim();
  const tiles: (AboutStat | null)[] = [
    productTotal > 0
      ? { id: "products", value: formatCount(productTotal), label: copy.reviewers(productTotal) }
      : null,
    examCount > 0
      ? { id: "exams", value: formatCount(examCount), label: copy.exams(examCount) }
      : null,
    rating > 0 && ratingCount > 0
      ? {
          id: "rating",
          value: formatRating(rating),
          label: copy.ratings(ratingCount, formatCount(ratingCount)),
        }
      : null,
    // A figure as entered, like "3.7K"; blank or "0" means there's none.
    Number(followers) !== 0 ? { id: "followers", value: followers, label: copy.followers } : null,
  ];
  return tiles.filter((tile) => tile !== null);
}
