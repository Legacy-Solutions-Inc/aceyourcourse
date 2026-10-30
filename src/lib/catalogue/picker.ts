import { productsPageCopy } from "@/content/products-page";
import type { Product, ProductFormat } from "@/services/catalogue.types";

/** The "Help me choose" picker's second question: how the Visitor likes to study. */
export const STUDY_STYLES = ["on-the-go", "on-my-wall", "solving", "everything", "app"] as const;
export type StudyStyle = (typeof STUDY_STYLES)[number];

/**
 * The formats each printed style prefers, best first (Products_v2.dc.html
 * L153–158). "App" picks by "Available in app" instead.
 */
const PREFERRED_FORMATS: Record<Exclude<StudyStyle, "app">, ProductFormat[]> = {
  "on-the-go": ["flash-cards"],
  "on-my-wall": ["posters", "flash-cards"],
  solving: ["notebook", "flash-cards"],
  everything: ["bundle", "flash-cards"],
};

export interface Recommendation {
  product: Product;
  reason: string;
}

const copy = productsPageCopy.picker;

/**
 * Pure: the one Product "Help me choose" recommends for an Exam and a study
 * style, from Products in best-seller order (as listProducts() returns them).
 * Only Live Products count. It is the first of the Exam's Products in the
 * style's preferred formats, otherwise the Exam's best seller. "App" picks the
 * first Product that's in the app, and is offered only while the Member App
 * switch is on. Null when the Exam has no Live Products.
 */
export function recommendProduct(
  products: Product[],
  examCode: string,
  style: StudyStyle,
  { memberAppLive = false }: { memberAppLive?: boolean } = {},
): Recommendation | null {
  if (style === "app" && !memberAppLive) return null;
  const exam = examCode.toUpperCase();
  const examProducts = products.filter((p) => p.state === "live" && p.examCode === exam);
  const [bestSeller] = examProducts;
  if (!bestSeller) return null;

  // Said when the Product isn't the style's first choice.
  const closestFit = (product: Product) =>
    memberAppLive && product.availableInApp
      ? `${copy.closestFit(exam, product.shortName)} ${copy.app.alsoInApp}`
      : copy.closestFit(exam, product.shortName);

  if (style === "app") {
    const inApp = examProducts.find((p) => p.availableInApp);
    return inApp
      ? { product: inApp, reason: copy.styles.app.reason }
      : { product: bestSeller, reason: closestFit(bestSeller) };
  }

  const preferred = PREFERRED_FORMATS[style];
  const product =
    preferred.flatMap((format) => examProducts.filter((p) => p.format === format))[0] ?? bestSeller;
  const reason = product.format === preferred[0] ? copy.styles[style].reason : closestFit(product);
  return { product, reason };
}
