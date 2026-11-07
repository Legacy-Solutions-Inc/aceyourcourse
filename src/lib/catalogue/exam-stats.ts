import type { Product } from "@/services/catalogue.types";

export interface ExamStats {
  productCount: number;
  unitsSold: number;
  /** Weighted by each Product's number of ratings, to one decimal. Null with no ratings. */
  averageRating: number | null;
  /** Centavos: the lowest Live price. Null with no Live Product. */
  priceFrom: number | null;
}

/**
 * Pure: the Exam page hero's stats, from Live Products only. Coming Soon
 * Products aren't for sale, so they never count. A Product without Shopee
 * figures counts toward the number of Products and the price only.
 */
export function examStats(products: Product[]): ExamStats {
  const live = products.filter((product) => product.state === "live");
  const figures = live.flatMap((product) => (product.shopee ? [product.shopee] : []));
  const prices = live.flatMap((product) => (product.priceFrom === null ? [] : [product.priceFrom]));

  const ratingCount = figures.reduce((total, f) => total + f.ratingCount, 0);
  const ratingTotal = figures.reduce((total, f) => total + f.rating * f.ratingCount, 0);

  return {
    productCount: live.length,
    unitsSold: figures.reduce((total, f) => total + f.unitsSold, 0),
    averageRating: ratingCount === 0 ? null : Math.round((ratingTotal / ratingCount) * 10) / 10,
    priceFrom: prices.length === 0 ? null : Math.min(...prices),
  };
}
