import { serverEnv } from "@/env.server";
import { productFormatLabel } from "@/lib/catalogue/format";
import {
  examPageDefaults,
  FAQ_GROUP_TITLES,
  FAQ_GROUPS,
  sitePageDefaults,
} from "@/services/catalogue.schema";
import type { CatalogueSeed } from "@/services/catalogue.schema";
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
  SitePage,
  SitePageKey,
  WebsiteSettings,
} from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Catalogue seam's rules, shared by both arms: which records the Website
// shows, the filters, the sort orders (ties keep seed order) and the FAQ
// groups. Each arm only says where the catalogue comes from: the sample store
// (catalogue.mock.ts) or Postgres (catalogue.db.ts). So the two arms can't
// disagree on a rule, and the database needs no copy of them in SQL.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gives the parts of the catalogue a read needs, as the seed holds them. What
 * it returns is the caller's own: a read may hand it out as it is.
 */
export type LoadCatalogue = <Part extends keyof CatalogueSeed>(
  parts: readonly Part[],
) => Promise<Pick<CatalogueSeed, Part>>;

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

const comingSoonOrder = (exams: readonly Exam[]) => {
  const examOrder = (p: Product) => exams.findIndex((e) => e.code === p.examCode);
  return by(ascending(examOrder), byTitle);
};

// ── Products ────────────────────────────────────────────────────────────────

const visible = (products: readonly Product[]) => products.filter((p) => p.showOnWebsite);
const live = (products: readonly Product[]) => visible(products).filter((p) => p.state === "live");

/** Everything a Visitor's search is matched against, lowercased. */
function searchText(p: Product, exams: readonly Exam[]): string {
  const exam = exams.find((e) => e.code === p.examCode);
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

// ── Exams ───────────────────────────────────────────────────────────────────

/** An Exam code as URLs give it ("ce", " CE "), as the catalogue stores it. Blank is "". */
const examCodeOf = (code: string) => code.trim().toUpperCase();

/** Case-insensitive. Null when the code is unknown or blank. */
function findExam(exams: readonly Exam[], code: string): Exam | null {
  const wanted = examCodeOf(code);
  return (wanted && exams.find((e) => e.code === wanted)) || null;
}

// ── Reviews ─────────────────────────────────────────────────────────────────

/** Reviews of the visible Live Products, each with its Product. */
function visibleReviews(
  reviews: readonly Review[],
  products: readonly Product[],
): ReviewWithProduct[] {
  const shown = new Map(live(products).map((p) => [p.id, p]));
  return reviews.flatMap((review) => {
    const p = shown.get(review.productId);
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

function reviewSort(sort: ReviewSort, products: readonly Product[]): Compare<ReviewWithProduct> {
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
        live(products)
          .sort(bestSelling)
          .map((p, index) => [p.slug, index]),
      );
      return ascending((r) => rank.get(r.product.slug) ?? Infinity);
    }
  }
}

const HOME_REVIEW_COUNT = 9;

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

// ── The reads ───────────────────────────────────────────────────────────────

/** The Catalogue seam's reads over the catalogue `load` gives (see CatalogueService). */
export function catalogueReads(load: LoadCatalogue) {
  async function listProducts(
    filters: ProductFilters = {},
  ): Promise<{ items: Product[]; total: number }> {
    const { exams, products } = await load(["exams", "products"]);
    const state = filters.state ?? "live";
    const examCode = filters.examCode?.toUpperCase();
    const query = normalise(filters.query);

    const items = visible(products).filter(
      (p) =>
        p.state === state &&
        (!examCode || p.examCode === examCode) &&
        (!filters.format || p.format === filters.format) &&
        (!query || searchText(p, exams).includes(query)) &&
        (filters.availableInApp === undefined || p.availableInApp === filters.availableInApp) &&
        // Coming Soon has no price, so the price filter doesn't apply to it.
        (state !== "live" || filters.maxPrice === undefined || priceFrom(p) <= filters.maxPrice),
    );
    items.sort(
      state === "live" ? PRODUCT_SORTS[filters.sort ?? "best-selling"] : comingSoonOrder(exams),
    );
    return { items, total: items.length };
  }

  async function getProductBySlug(slug: string): Promise<Product | null> {
    const { products } = await load(["products"]);
    return visible(products).find((p) => p.slug === slug) ?? null;
  }

  async function listRelatedProducts(
    product: Product,
    limit = 3,
  ): Promise<{ scope: "same-exam" | "other-exams"; items: Product[] }> {
    const { products } = await load(["products"]);
    const others = live(products).filter((p) => p.id !== product.id);
    const sameExam = others.filter((p) => p.examCode === product.examCode).sort(bestSelling);
    if (sameExam.length > 0) return { scope: "same-exam", items: sameExam.slice(0, limit) };

    const otherExams = others.filter((p) => p.examCode !== product.examCode && p.shopee);
    return { scope: "other-exams", items: otherExams.sort(bestSelling).slice(0, limit) };
  }

  async function listBestSellers(limit: number): Promise<Product[]> {
    const { products } = await load(["products"]);
    const ranked = live(products)
      .filter((p) => p.shopee)
      .sort(bestSelling);
    return ranked.slice(0, limit);
  }

  /** Exams with at least one Product on the Website, Live or Coming Soon. */
  async function listExams(): Promise<Exam[]> {
    const { exams, products } = await load(["exams", "products"]);
    const shown = new Set(visible(products).map((p) => p.examCode));
    return exams.filter((e) => shown.has(e.code));
  }

  async function getExamByCode(code: string): Promise<Exam | null> {
    if (!examCodeOf(code)) return null;
    const { exams } = await load(["exams"]);
    return findExam(exams, code);
  }

  /**
   * An Exam's page as the Website shows it. Its bundle offer comes with its
   * Product, and only while that Product is Live and on the Website.
   */
  async function getExamPage(code: string): Promise<ExamPageContent | null> {
    if (!examCodeOf(code)) return null;
    const { exams, examPages, products } = await load(["exams", "examPages", "products"]);
    const exam = findExam(exams, code);
    if (!exam) return null;
    const page = examPages.find((p) => p.examCode === exam.code) ?? examPageDefaults(exam.code);
    const { bundleOffer, ...rest } = page;
    const product = bundleOffer
      ? live(products).find((p) => p.id === bundleOffer.productId)
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
    return { ...rest, bundleOffer: offer };
  }

  /** A Site page's record, or nothing set while it has none. */
  async function getSitePage(page: SitePageKey): Promise<SitePage> {
    const { sitePages } = await load(["sitePages"]);
    return sitePages.find((record) => record.page === page) ?? sitePageDefaults(page);
  }

  async function listReviews(
    filters: ReviewFilters = {},
  ): Promise<{ items: ReviewWithProduct[]; total: number }> {
    const { reviews, products } = await load(["reviews", "products"]);
    const examCode = filters.examCode?.toUpperCase();
    const inBucket = filters.stars ? STAR_BUCKETS[filters.stars] : () => true;
    const query = normalise(filters.query);

    const matching = visibleReviews(reviews, products).filter(
      (r) =>
        (!filters.productSlug || r.product.slug === filters.productSlug) &&
        (!examCode || r.product.examCode === examCode) &&
        inBucket(r.stars) &&
        (!query ||
          [r.text, r.product.shortName, r.variation ?? ""]
            .join("\n")
            .toLowerCase()
            .includes(query)),
    );
    matching.sort(reviewSort(filters.sort ?? "most-helpful", products));
    const items = filters.limit === undefined ? matching : matching.slice(0, filters.limit);
    return { items, total: matching.length };
  }

  async function listHomeReviews(): Promise<ReviewWithProduct[]> {
    const { reviews, products } = await load(["reviews", "products"]);
    const pinned = visibleReviews(reviews, products).filter((r) => r.homePin !== null);
    pinned.sort(ascending((r) => r.homePin ?? 0));
    return pinned.slice(0, HOME_REVIEW_COUNT);
  }

  async function listFaqs(): Promise<FaqGroupWithItems[]> {
    const { faqs, reviews, products } = await load(["faqs", "reviews", "products"]);
    const appLive = memberAppLive();
    const credits = new Map(visibleReviews(reviews, products).map((review) => [review.id, review]));
    const shown = faqs.filter((faq) => faq.showOnFaqPage && (appLive || !faq.requiresMemberApp));
    return FAQ_GROUPS.flatMap((group) => {
      const { title, appTitle } = FAQ_GROUP_TITLES[group];
      const items = shown
        .filter((faq) => faq.group === group)
        .sort(ascending((faq) => faq.order))
        .map((faq) => withQuoteCredit(faq, credits));
      if (items.length === 0) return [];
      return [{ group, title: (appLive && appTitle) || title, items }];
    });
  }

  async function getWebsiteSettings(): Promise<WebsiteSettings> {
    const { settings } = await load(["settings"]);
    return { ...settings, memberAppLive: memberAppLive() };
  }

  return {
    listExams,
    getExamByCode,
    getExamPage,
    getSitePage,
    listProducts,
    getProductBySlug,
    listRelatedProducts,
    listBestSellers,
    listReviews,
    listHomeReviews,
    listFaqs,
    getWebsiteSettings,
  };
}
