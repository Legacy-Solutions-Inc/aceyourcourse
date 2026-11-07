import { bundleSaving } from "@/lib/catalogue/price";
import type { Exam, Product, ProductFormat, ProductPhoto } from "@/services/catalogue.types";

/** What a Home format card shows that comes from the catalogue. */
export interface FormatCardStats {
  /** "For": the Exams with Live Products in this format, in Exam order. */
  examCodes: string[];
  /**
   * "From": the lowest Live price, in centavos. For bundles it is the whole
   * set's price, because the card sells the set, not one of its parts.
   */
  priceFrom: number;
  /** The best-selling Product's cover. */
  coverPhoto: ProductPhoto | null;
  /**
   * Centavos each Product saves as a whole set over its parts, the least of
   * them, so the claim holds for all. Null when any saves nothing, as every
   * format but bundle does.
   */
  saving: number | null;
}

type PricedProduct = Product & { priceFrom: number };

/**
 * Pure: each format's card figures, from Products in best-selling order (as
 * listProducts returns them). A format with no Live Products is left out, so
 * its card isn't shown. Coming Soon Products have no price and never count.
 */
export function formatCardStats(
  products: Product[],
  exams: Pick<Exam, "code">[],
): Partial<Record<ProductFormat, FormatCardStats>> {
  const live = products.filter(
    (product): product is PricedProduct => product.state === "live" && product.priceFrom !== null,
  );
  const stats: Partial<Record<ProductFormat, FormatCardStats>> = {};
  for (const format of new Set(live.map((product) => product.format))) {
    const ofFormat = live.filter((product) => product.format === format);
    const savings = ofFormat.map(bundleSaving).filter((saving) => saving !== null);
    stats[format] = {
      examCodes: exams
        .map((exam) => exam.code)
        .filter((code) => ofFormat.some((product) => product.examCode === code)),
      priceFrom: Math.min(
        ...ofFormat.map((product) =>
          format === "bundle" ? (product.priceTo ?? product.priceFrom) : product.priceFrom,
        ),
      ),
      coverPhoto: ofFormat[0]?.photos[0] ?? null,
      saving: savings.length === ofFormat.length ? Math.min(...savings) : null,
    };
  }
  return stats;
}
