import { isReviewStars, type NewReviewForm, type ReviewForm } from "@/services/admin.schema";
import type { ReviewProductOption } from "@/services/admin.types";
import type { Review, ReviewWithProduct } from "@/services/catalogue.types";

// The Review editor's values (BUILD-MAP §3.4, Editor): a Review's fields as
// its form holds them, and back through the seam's schema (admin.schema.ts).
// The variation is "" when it isn't specified, and the helpful votes are text.

/** Pure: a Review's fields as its editor opens them. */
export function reviewFormValues(review: Review): ReviewForm {
  return {
    stars: review.stars,
    text: review.text,
    productId: review.productId,
    variation: review.variation ?? "",
    marketplace: review.marketplace,
    helpful: String(review.helpful),
  };
}

/** Pure: a new Review's form: 5★, for this Product, from Shopee, not pinned on Home (mockup 1162). */
export function newReviewForm(productId: string): NewReviewForm {
  return {
    stars: 5,
    text: "",
    productId,
    variation: "",
    marketplace: "shopee",
    helpful: "",
    pinned: false,
  };
}

/**
 * Pure: VARIATION BOUGHT's choices besides "Not specified": the Product's
 * variations, and the Review's own when it was copied from the Marketplace in
 * another form, so opening and saving a Review never loses it.
 */
export function variationChoices(
  product: ReviewProductOption | undefined,
  saved: { productId: string; variation: string | null } | null,
): string[] {
  const choices = [...(product?.variations ?? [])];
  if (saved?.variation && saved.productId === product?.id && !choices.includes(saved.variation)) {
    choices.unshift(saved.variation);
  }
  return choices;
}

/** Pure: "CE · CE Formula Flash Cards", as the PRODUCT select lists it (mockup 1167). */
export const productOptionLabel = (product: ReviewProductOption) =>
  `${product.examCode} · ${product.shortName}`;

/**
 * Pure: the Website's Review card for the form's values, for PREVIEW, or null
 * until there's text (mockup 1158). Stars or votes that aren't valid yet show
 * as 5★ and none.
 */
export function reviewPreview(
  form: ReviewForm,
  product: ReviewProductOption | undefined,
): ReviewWithProduct | null {
  if (!form.text.trim() || !product) return null;
  const helpful = Number(form.helpful.trim());
  return {
    id: "preview",
    productId: product.id,
    stars: isReviewStars(form.stars) ? form.stars : 5,
    text: form.text,
    variation: form.variation.trim() || null,
    helpful: Number.isInteger(helpful) && helpful > 0 ? helpful : 0,
    marketplace: form.marketplace,
    homePin: null,
    product: { slug: product.slug, shortName: product.shortName, examCode: product.examCode },
  };
}
