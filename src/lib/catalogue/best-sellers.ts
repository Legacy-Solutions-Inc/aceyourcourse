import type { Product } from "@/services/catalogue.types";

/**
 * Pure: the width of a best seller's sold bar, its units sold as a whole
 * percentage of the top seller's, clamped to 0–100. 0 when either has no
 * Shopee figures or the top seller has sold nothing.
 */
export function soldBarPercent(product: Product, top: Product): number {
  const sold = product.shopee?.unitsSold ?? 0;
  const topSold = top.shopee?.unitsSold ?? 0;
  if (topSold <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((sold / topSold) * 100)));
}

/**
 * Pure: the "as of" date for a set of Products' Shopee figures, the oldest
 * date any of them was copied, so none is newer than the label says. Null
 * when none has figures.
 */
export function figuresAsOf(products: Product[]): string | null {
  const dates = products.flatMap((product) => (product.shopee ? [product.shopee.asOf] : []));
  // ISO dates sort as text.
  return dates.length === 0
    ? null
    : dates.reduce((oldest, date) => (date < oldest ? date : oldest));
}
