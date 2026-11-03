import { serverEnv } from "@/env.server";
import { productFormatLabel } from "@/lib/catalogue/format";
import {
  examPageDefaults,
  FAQ_GROUP_TITLES,
  FAQ_GROUPS,
  validateCatalogueSeed,
} from "@/services/catalogue.schema";
import type {
  Exam,
  ExamPageContent,
  Faq,
  FaqGroupWithItems,
  FaqWithQuote,
  Product,
  ProductFilters,
  ProductSort,
  Review,
  ReviewFilters,
  ReviewSort,
  ReviewWithProduct,
  WebsiteSettings,
} from "@/services/catalogue.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { getSampleStore } from "@/services/mock/sample-store";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory implementation of the Catalogue seam, and the Phase 1 default. It
// reads the catalogue held in the Admin's sample store, a copy of the typed
// seed, so an Admin save shows on the Website (src/services/mock/sample-store.ts).
// The seed is validated once at load so a bad edit fails loudly, and every
// Admin write is validated again before the store takes it. The Member App
// switch comes from MEMBER_APP_LIVE, not the seed. See
// docs/adr/0003-mock-first-service-seam.md.
// ─────────────────────────────────────────────────────────────────────────────

// The sample store validates the seed too, but only when it's first read; this
// makes a bad seed fail as soon as the Website loads.
const validation = validateCatalogueSeed(CATALOGUE_SEED);
if (!validation.success) {
  throw new Error(`Invalid catalogue seed — ${validation.errors.join("; ")}`);
}

/** The catalogue as it is now, with every Admin save so far. */
const catalogue = () => getSampleStore().catalogue;

// Callers get copies, so nothing a page does can change the catalogue for the next
// request (a database read returns fresh rows the same way).
const copy = <T>(value: T): T => structuredClone(value);

/** The Member App switch (MEMBER_APP_LIVE). */
export const memberAppLive = () => serverEnv.MEMBER_APP_LIVE === "true";

// ── Ordering ────────────────────────────────────────────────────────────────

type Compare<T> = (a: T, b: T) => number;

/** Compares by each key in turn; equal items keep their seed order (sort is stable). */
const by =
  <T>(...comparators: Compare<T>[]): Compare<T> =>
  (a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
const ascending =
  <T>(key: (item: T) => number): Compare<T> =>
  (a, b) =>
    key(a) - key(b);
const descending =
  <T>(key: (item: T) => number): Compare<T> =>
  (a, b) =>
    key(b) - key(a);
const byTitle: Compare<Product> = (a, b) => a.title.localeCompare(b.title, "en");

// A Product without Shopee figures sorts after every Product that has them.
const unitsSold = (p: Product) => p.shopee?.unitsSold ?? -1;
const rating = (p: Product) => p.shopee?.rating ?? -1;
const ratingCount = (p: Product) => p.shopee?.ratingCount ?? -1;
// Only Live Products are sorted by price, and they always have one.
const priceFrom = (p: Product) => p.priceFrom ?? 0;

const bestSelling = by(descending(unitsSold), byTitle);

const PRODUCT_SORTS: Record<ProductSort, Compare<Product>> = {
  "best-selling": bestSelling,
  "price-asc": by(ascending(priceFrom), descending(unitsSold)),
  "price-desc": by(descending(priceFrom), descending(unitsSold)),
  "top-rated": by(descending(rating), descending(ratingCount)),
};

const examOrder = (p: Product) => catalogue().exams.findIndex((e) => e.code === p.examCode);
const comingSoonOrder = by(ascending(examOrder), byTitle);

// ── Products ────────────────────────────────────────────────────────────────

const visibleProducts = () => catalogue().products.filter((p) => p.showOnWebsite);
const liveProducts = () => visibleProducts().filter((p) => p.state === "live");

/** Everything a Visitor's search is matched against, lowercased. */
function searchText(p: Product): string {
  const exam = catalogue().exams.find((e) => e.code === p.examCode);
  const subjects = (exam?.subjects ?? []).filter((s) => p.subjectCodes.includes(s.code));
  return [
    p.title,
    p.shortName,
    p.examCode,
    exam?.board,
    exam?.name,
    productFormatLabel(p.format),
    ...subjects.flatMap((s) => [s.code, s.name]),
  ]
    .join("\n")
    .toLowerCase();
}

const normalise = (query: string | undefined) => query?.trim().toLowerCase() ?? "";

export async function listProducts(
  filters: ProductFilters = {},
): Promise<{ items: Product[]; total: number }> {
  const state = filters.state ?? "live";
  const examCode = filters.examCode?.toUpperCase();
  const query = normalise(filters.query);

  const items = visibleProducts().filter(
    (p) =>
      p.state === state &&
      (!examCode || p.examCode === examCode) &&
      (!filters.format || p.format === filters.format) &&
      (!query || searchText(p).includes(query)) &&
      (filters.availableInApp === undefined || p.availableInApp === filters.availableInApp) &&
      // Coming Soon has no price, so the price filter doesn't apply to it.
      (state !== "live" || filters.maxPrice === undefined || priceFrom(p) <= filters.maxPrice),
  );
  items.sort(state === "live" ? PRODUCT_SORTS[filters.sort ?? "best-selling"] : comingSoonOrder);
  return { items: copy(items), total: items.length };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const product = visibleProducts().find((p) => p.slug === slug);
  return product ? copy(product) : null;
}

export async function listRelatedProducts(
  product: Product,
  limit = 3,
): Promise<{ scope: "same-exam" | "other-exams"; items: Product[] }> {
  const others = liveProducts().filter((p) => p.id !== product.id);
  const sameExam = others.filter((p) => p.examCode === product.examCode).sort(bestSelling);
  if (sameExam.length > 0) return { scope: "same-exam", items: copy(sameExam.slice(0, limit)) };

  const otherExams = others.filter((p) => p.examCode !== product.examCode && p.shopee);
  return { scope: "other-exams", items: copy(otherExams.sort(bestSelling).slice(0, limit)) };
}

export async function listBestSellers(limit: number): Promise<Product[]> {
  const ranked = liveProducts()
    .filter((p) => p.shopee)
    .sort(bestSelling);
  return copy(ranked.slice(0, limit));
}

// ── Exams ───────────────────────────────────────────────────────────────────

/** Exams with at least one Product on the Website, Live or Coming Soon. */
export async function listExams(): Promise<Exam[]> {
  const shown = new Set(visibleProducts().map((p) => p.examCode));
  return copy(catalogue().exams.filter((e) => shown.has(e.code)));
}

export async function getExamByCode(code: string): Promise<Exam | null> {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return null;
  const exam = catalogue().exams.find((e) => e.code === wanted);
  return exam ? copy(exam) : null;
}

/**
 * An Exam's page as the Website shows it. Its bundle offer comes with its
 * Product, and only while that Product is Live and on the Website.
 */
export async function getExamPage(code: string): Promise<ExamPageContent | null> {
  const exam = await getExamByCode(code);
  if (!exam) return null;
  const page =
    catalogue().examPages.find((p) => p.examCode === exam.code) ?? examPageDefaults(exam.code);
  const { bundleOffer, ...rest } = page;
  const product = bundleOffer
    ? liveProducts().find((p) => p.id === bundleOffer.productId)
    : undefined;
  const offer =
    bundleOffer && product
      ? {
          headline: bundleOffer.headline,
          text: bundleOffer.text,
          buttonLabel: bundleOffer.buttonLabel,
          product,
        }
      : null;
  return copy({ ...rest, bundleOffer: offer });
}

// ── Reviews ─────────────────────────────────────────────────────────────────

/** Reviews of the visible Live Products, each with its Product. */
function visibleReviews(): ReviewWithProduct[] {
  const products = new Map(liveProducts().map((p) => [p.id, p]));
  return catalogue().reviews.flatMap((review) => {
    const p = products.get(review.productId);
    return p
      ? [{ ...review, product: { slug: p.slug, shortName: p.shortName, examCode: p.examCode } }]
      : [];
  });
}

const STAR_BUCKETS: Record<NonNullable<ReviewFilters["stars"]>, (stars: number) => boolean> = {
  "5": (stars) => stars === 5,
  "4": (stars) => stars === 4,
  "3-or-less": (stars) => stars <= 3,
};

const stars = (r: Review) => r.stars;
const helpful = (r: Review) => r.helpful;
const textLength = (r: Review) => r.text.length;

function reviewSort(sort: ReviewSort): Compare<ReviewWithProduct> {
  switch (sort) {
    case "most-helpful":
      return by(descending(helpful), descending(stars), descending(textLength));
    case "highest":
      return by(descending(stars), descending(helpful));
    case "most-critical":
      return by(ascending(stars), descending(helpful));
    case "most-detailed":
      return descending(textLength);
    case "exam-page": {
      const rank = new Map(
        liveProducts()
          .sort(bestSelling)
          .map((p, index) => [p.slug, index]),
      );
      return ascending((r) => rank.get(r.product.slug) ?? Infinity);
    }
  }
}

export async function listReviews(
  filters: ReviewFilters = {},
): Promise<{ items: ReviewWithProduct[]; total: number }> {
  const examCode = filters.examCode?.toUpperCase();
  const inBucket = filters.stars ? STAR_BUCKETS[filters.stars] : () => true;
  const query = normalise(filters.query);

  const matching = visibleReviews().filter(
    (r) =>
      (!filters.productSlug || r.product.slug === filters.productSlug) &&
      (!examCode || r.product.examCode === examCode) &&
      inBucket(r.stars) &&
      (!query ||
        [r.text, r.product.shortName, r.variation ?? ""].join("\n").toLowerCase().includes(query)),
  );
  matching.sort(reviewSort(filters.sort ?? "most-helpful"));
  const items = filters.limit === undefined ? matching : matching.slice(0, filters.limit);
  return { items: copy(items), total: matching.length };
}

const HOME_REVIEW_COUNT = 9;

export async function listHomeReviews(): Promise<ReviewWithProduct[]> {
  const pinned = visibleReviews().filter((r) => r.homePin !== null);
  pinned.sort(ascending((r) => r.homePin ?? 0));
  return copy(pinned.slice(0, HOME_REVIEW_COUNT));
}

// ── FAQs ────────────────────────────────────────────────────────────────────

/** Credits the FAQ's quote to its Review, or drops it if that Review isn't shown. */
function withQuoteCredit(faq: Faq, reviews: Map<string, ReviewWithProduct>): FaqWithQuote {
  const review = faq.reviewQuote ? reviews.get(faq.reviewQuote.reviewId) : undefined;
  if (!faq.reviewQuote || !review) return { ...faq, reviewQuote: null };
  return {
    ...faq,
    reviewQuote: {
      ...faq.reviewQuote,
      stars: review.stars,
      variation: review.variation,
      product: review.product,
    },
  };
}

export async function listFaqs(): Promise<FaqGroupWithItems[]> {
  const appLive = memberAppLive();
  const reviews = new Map(visibleReviews().map((review) => [review.id, review]));
  const shown = catalogue().faqs.filter(
    (faq) => faq.showOnFaqPage && (appLive || !faq.requiresMemberApp),
  );
  const groups = FAQ_GROUPS.flatMap((group) => {
    const { title, appTitle } = FAQ_GROUP_TITLES[group];
    const items = shown
      .filter((faq) => faq.group === group)
      .sort(ascending((faq) => faq.order))
      .map((faq) => withQuoteCredit(faq, reviews));
    if (items.length === 0) return [];
    return [{ group, title: (appLive && appTitle) || title, items }];
  });
  return copy(groups);
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  return { ...copy(catalogue().settings), memberAppLive: memberAppLive() };
}
