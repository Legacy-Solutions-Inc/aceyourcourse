import { websiteCopy } from "@/content/website";
import { formatPeso } from "@/lib/money";
import type { Product } from "@/services/catalogue.types";

// Price labels. A Coming Soon Product has no price, so every label is null for
// it and the mockup's "₱0" can never render.

/** "₱1,200", or "from ₱600" when the Product is priced as a range. */
export function productPriceLabel(product: Product): string | null {
  if (product.state !== "live" || product.priceFrom === null) return null;
  const from = formatPeso(product.priceFrom);
  return isRange(product) ? `from ${from}` : from;
}

/** "₱600–₱1,550", or "₱1,200" when the Product has a single price. */
export function productPriceRange(product: Product): string | null {
  if (product.state !== "live" || product.priceFrom === null) return null;
  const from = formatPeso(product.priceFrom);
  return isRange(product) && product.priceTo !== null
    ? `${from}–${formatPeso(product.priceTo)}`
    : from;
}

/**
 * "₱3,499": the top of the Product's price, its whole set (the CE bundle's
 * 3-in-1, where each part alone is from ₱1,200). Null for Coming Soon.
 */
export function productFullPrice(product: Product): string | null {
  if (product.state !== "live" || product.priceFrom === null) return null;
  return formatPeso(product.priceTo ?? product.priceFrom);
}

/**
 * The note shown in place of variations: a range-priced Product is picked on
 * the store page, otherwise there is one option. Null for Coming Soon.
 */
export function productOptionsNote(product: Product): string | null {
  if (product.state !== "live" || product.priceFrom === null) return null;
  return isRange(product) && product.priceTo !== null
    ? `${websiteCopy.product.pickOnStore} ${formatPeso(product.priceFrom)} to ${formatPeso(product.priceTo)}.`
    : websiteCopy.product.oneOption;
}

function isRange(product: Product): boolean {
  return product.priceTo !== null && product.priceTo !== product.priceFrom;
}

/** A Marketplace variation name without its "PREFIX: " part. */
export function variationLabel(name: string): string {
  return name.replace(/^[^:]+:\s*/, "");
}
