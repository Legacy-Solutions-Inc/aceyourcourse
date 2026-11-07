import { variationLabel } from "@/lib/catalogue/price";
import {
  type NewReviewForm,
  newReviewFormSchema,
  type ReviewForm,
  reviewFormSchema,
  reviewIdInputSchema,
  type ReviewInput,
  type ReviewMove,
  reviewMoveSchema,
  reviewPinSchema,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminResult,
  AdminReview,
  AdminReviewList,
  AdminReviewRow,
  DeletedReview,
  RecordStamp,
  ReviewDeletePreview,
  ReviewListQuery,
  ReviewProductOption,
  ReviewStarsFilter,
  StaffActor,
} from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { Review } from "@/services/catalogue.types";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's Reviews area: the Reviews list, with
// every Review, a hidden Product's included; the editor's add and save; the
// HOME switch and the Home order's ▲▼; and delete. Each Review is its own
// record, with its own stamp for the editor's conflict check. The HOME switch
// is a single toggle, which always saves (spec, Phase 2 → Conflict check), so
// it has a stamp of its own and never makes an open editor's save a conflict;
// ▲▼ always saves too. Home shows the pinned Reviews by their homePin, lowest
// first: pinning puts a Review after the last one, and ▲▼ swaps two of them.

/** A Review's record key, for the stamp its editor checks. */
const recordOf = (id: string) => `review:${id}`;

/** The record key of a Review's HOME switch. */
const pinRecordOf = (id: string) => `review:${id}:pin`;

/** The record key of the Home order, which ▲▼ changes. */
const HOME_ORDER_RECORD = "reviews:home-order";

const findReview = (catalogue: CatalogueSeed, id: string) =>
  catalogue.reviews.find((review) => review.id === id);

const exists = (id: string) => (catalogue: CatalogueSeed) =>
  findReview(catalogue, id) !== undefined;

/** The pinned Reviews, in the Home order. */
const pinnedReviews = (catalogue: CatalogueSeed) =>
  catalogue.reviews
    .filter((review) => review.homePin !== null)
    .sort((a, b) => (a.homePin ?? 0) - (b.homePin ?? 0));

const homeOrderOf = (catalogue: CatalogueSeed) => pinnedReviews(catalogue).map((r) => r.id);

/** The next homePin: after the last one, so a new pin goes to the end of the Home order. */
const nextPin = (catalogue: CatalogueSeed) =>
  Math.max(0, ...catalogue.reviews.map((review) => review.homePin ?? 0)) + 1;

/** The FAQs quoting this Review. */
const faqsQuoting = (catalogue: CatalogueSeed, id: string) =>
  catalogue.faqs.filter((faq) => faq.reviewQuote?.reviewId === id);

const STAR_BUCKETS: Record<ReviewStarsFilter, (stars: number) => boolean> = {
  "5": (stars) => stars === 5,
  "4": (stars) => stars === 4,
  "3-or-less": (stars) => stars <= 3,
};

/** The Live Products a Review can be for, a hidden one included. */
function productOptions(catalogue: CatalogueSeed): ReviewProductOption[] {
  return catalogue.products
    .filter((product) => product.state === "live")
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      examCode: product.examCode,
      shortName: product.shortName,
      variations: product.variations.map((variation) => variationLabel(variation.name)),
    }));
}

export async function listReviewsForAdmin(
  _actor: StaffActor,
  query: ReviewListQuery,
): Promise<AdminReviewList> {
  const { catalogue } = getSampleStore();
  const products = new Map(catalogue.products.map((product) => [product.id, product]));

  const q = query.q?.trim() || null;
  const search = q?.toLowerCase();
  const exam =
    catalogue.exams.find((e) => e.code === query.exam?.trim().toUpperCase())?.code ?? null;
  const stars = query.stars && query.stars in STAR_BUCKETS ? query.stars : null;
  const pinned = query.pinned === true;

  const reviews = pinned ? pinnedReviews(catalogue) : catalogue.reviews;
  const rows = reviews.flatMap((review): AdminReviewRow[] => {
    const product = products.get(review.productId);
    if (!product) return [];
    const matches =
      (!exam || product.examCode === exam) &&
      (!stars || STAR_BUCKETS[stars](review.stars)) &&
      (!search || review.text.toLowerCase().includes(search));
    return matches
      ? [{ review, product: { shortName: product.shortName, examCode: product.examCode } }]
      : [];
  });

  return structuredClone({
    rows,
    query: { q, exam, stars, pinned },
    examCodes: catalogue.exams.map((e) => e.code),
    total: catalogue.reviews.length,
    homeOrder: homeOrderOf(catalogue),
    // Home skips a hidden Product's Reviews before it takes the first 9.
    pinnedOnHome: pinnedReviews(catalogue).filter((review) => {
      const product = products.get(review.productId);
      return product?.state === "live" && product.showOnWebsite;
    }).length,
    products: productOptions(catalogue),
  });
}

function adminReviewOf(
  catalogue: CatalogueSeed,
  id: string,
  stamp: RecordStamp,
): AdminReview | null {
  const review = findReview(catalogue, id);
  return review ? structuredClone({ review, stamp }) : null;
}

/** The saved value, read after the write committed. */
function savedReview(catalogue: CatalogueSeed, id: string): AdminReview {
  const saved = adminReviewOf(catalogue, id, stampOf(getSampleStore(), recordOf(id)));
  if (!saved) throw new Error(`Review ${id} vanished during its own save`);
  return saved;
}

export async function getReviewForAdmin(
  _actor: StaffActor,
  id: string,
): Promise<AdminReview | null> {
  const store = getSampleStore();
  return adminReviewOf(store.catalogue, id, stampOf(store, recordOf(id)));
}

/**
 * The rules that need the catalogue, with the editor's messages: a Live
 * Product, one of its variations, and the FAQ quotes taken from the Review.
 * `existing` is the Review being saved, or undefined for a new one. A
 * variation copied from the Marketplace in another form is kept while the Review
 * stays on its Product.
 */
function reviewRules(
  catalogue: CatalogueSeed,
  input: ReviewInput,
  existing: Review | undefined,
): AdminError | null {
  const product = catalogue.products.find((p) => p.id === input.productId);
  if (!product) return { kind: "invalid", fieldErrors: { productId: ["CHOOSE A PRODUCT"] } };
  if (product.state !== "live") {
    return {
      kind: "invalid",
      fieldErrors: { productId: ["COMING SOON PRODUCTS CAN’T HAVE REVIEWS"] },
    };
  }

  const { variation } = input;
  const kept = existing?.productId === product.id && existing.variation === variation;
  const offered = product.variations.some((v) => variationLabel(v.name) === variation);
  if (variation !== null && !kept && !offered) {
    return {
      kind: "invalid",
      fieldErrors: { variation: [`NOT A VARIATION OF ${product.shortName.toUpperCase()}`] },
    };
  }

  // Only a delete removes a quote: an edit that breaks one is refused (spec, Phase 2 → FAQ).
  const broken = existing
    ? faqsQuoting(catalogue, existing.id).find(
        (faq) => faq.reviewQuote && !input.text.includes(faq.reviewQuote.text),
      )
    : undefined;
  if (broken) {
    return {
      kind: "invalid",
      fieldErrors: {},
      formError: `The FAQ “${broken.question}” quotes this Review. Edit that quote first.`,
    };
  }
  return null;
}

/** A new Review's id: after the highest one, like the seed's ("rev-017"). */
function newReviewId(catalogue: CatalogueSeed): string {
  const numbers = catalogue.reviews.map((review) => Number(/^rev-(\d+)$/.exec(review.id)?.[1]));
  const next = Math.max(0, ...numbers.filter(Number.isFinite)) + 1;
  return `rev-${String(next).padStart(3, "0")}`;
}

export async function createReview(
  actor: StaffActor,
  input: NewReviewForm,
): Promise<AdminResult<AdminReview>> {
  const id = newReviewId(getSampleStore().catalogue);
  return writeCatalogue(actor, input, undefined, {
    role: "staff",
    schema: newReviewFormSchema,
    record: recordOf(id),
    check: (catalogue, { pinned: _pinned, ...fields }) => reviewRules(catalogue, fields, undefined),
    activity: { entity: "review", entityId: id, action: "create" },
    snapshot: (catalogue) => findReview(catalogue, id) ?? null,
    apply: (draft, { pinned, ...fields }) => {
      draft.reviews.push({ id, ...fields, homePin: pinned ? nextPin(draft) : null });
    },
    result: (catalogue) => savedReview(catalogue, id),
    tags: [CATALOGUE_TAGS.reviews],
  });
}

export async function updateReview(
  actor: StaffActor,
  id: string,
  input: ReviewForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminReview>> {
  return writeCatalogue(actor, input, expected, {
    role: "staff",
    schema: reviewFormSchema,
    record: recordOf(id),
    exists: exists(id),
    check: (catalogue, fields) => reviewRules(catalogue, fields, findReview(catalogue, id)),
    activity: { entity: "review", entityId: id, action: "update" },
    snapshot: (catalogue) => findReview(catalogue, id) ?? null,
    apply: (draft, fields) => {
      // Its id and its place in the Home order stay.
      draft.reviews = draft.reviews.map((review) =>
        review.id === id ? { ...review, ...fields } : review,
      );
    },
    result: (catalogue) => savedReview(catalogue, id),
    tags: [CATALOGUE_TAGS.reviews],
  });
}

export async function setReviewPinned(
  actor: StaffActor,
  id: string,
  pinned: boolean,
): Promise<AdminResult<AdminReview>> {
  const pinOf = (catalogue: CatalogueSeed) => {
    const review = findReview(catalogue, id);
    return review ? { homePin: review.homePin } : null;
  };
  // A single toggle always saves: no conflict check (spec, Phase 2 → Conflict check).
  return writeCatalogue(actor, { pinned }, undefined, {
    role: "staff",
    schema: reviewPinSchema,
    record: pinRecordOf(id),
    exists: exists(id),
    activity: { entity: "review", entityId: id, action: "set-home-pin" },
    snapshot: pinOf,
    apply: (draft, update) => {
      const review = findReview(draft, id);
      if (!review) return;
      // Pinned again, it keeps its place.
      if (!update.pinned) review.homePin = null;
      else review.homePin ??= nextPin(draft);
    },
    result: (catalogue) => savedReview(catalogue, id),
    tags: [CATALOGUE_TAGS.reviews],
  });
}

/** Why ▲ or ▼ can't move this Review, or null when it can. */
function moveRefusal(catalogue: CatalogueSeed, id: string, direction: ReviewMove) {
  const order = homeOrderOf(catalogue);
  const index = order.indexOf(id);
  const refuse = (formError: string): AdminError => ({
    kind: "invalid",
    fieldErrors: {},
    formError,
  });
  if (index === -1) return refuse("PIN IT ON HOME FIRST");
  if (direction === "up" && index === 0) return refuse("IT’S ALREADY FIRST ON HOME");
  if (direction === "down" && index === order.length - 1)
    return refuse("IT’S ALREADY LAST ON HOME");
  return null;
}

export async function moveReviewPin(
  actor: StaffActor,
  id: string,
  direction: ReviewMove,
): Promise<AdminResult<string[]>> {
  // Like a single toggle, ▲▼ always saves: there's no form to go stale.
  return writeCatalogue(actor, { direction }, undefined, {
    role: "staff",
    schema: reviewMoveSchema,
    record: HOME_ORDER_RECORD,
    exists: exists(id),
    check: (catalogue, move) => moveRefusal(catalogue, id, move.direction),
    activity: { entity: "review", entityId: id, action: "move-home-pin" },
    snapshot: homeOrderOf,
    apply: (draft, move) => {
      const pinned = pinnedReviews(draft);
      const index = pinned.findIndex((review) => review.id === id);
      const moving = pinned[index];
      const other = pinned[move.direction === "up" ? index - 1 : index + 1];
      if (!moving || !other) return;
      [moving.homePin, other.homePin] = [other.homePin, moving.homePin];
    },
    result: homeOrderOf,
    tags: [CATALOGUE_TAGS.reviews],
  });
}

export async function previewReviewDelete(
  _actor: StaffActor,
  id: string,
): Promise<ReviewDeletePreview | null> {
  const { catalogue } = getSampleStore();
  return findReview(catalogue, id) ? { faqQuotes: faqsQuoting(catalogue, id).length } : null;
}

export async function deleteReview(
  actor: StaffActor,
  id: string,
): Promise<AdminResult<DeletedReview>> {
  const faqQuotes = faqsQuoting(getSampleStore().catalogue, id).length;
  return writeCatalogue(actor, { id }, undefined, {
    role: "staff",
    schema: reviewIdInputSchema,
    record: recordOf(id),
    exists: exists(id),
    activity: { entity: "review", entityId: id, action: "delete" },
    // Staff Activity keeps every value the delete removes (spec, Phase 2 → Deleting).
    snapshot: (catalogue) => {
      const review = findReview(catalogue, id);
      return review ? { review, faqQuotes: faqsQuoting(catalogue, id) } : null;
    },
    apply: (draft) => {
      draft.reviews = draft.reviews.filter((review) => review.id !== id);
      draft.faqs = draft.faqs.map((faq) =>
        faq.reviewQuote?.reviewId === id ? { ...faq, reviewQuote: null } : faq,
      );
    },
    result: () => ({ id, faqQuotes }),
    tags: [CATALOGUE_TAGS.reviews, CATALOGUE_TAGS.faqs],
  });
}
