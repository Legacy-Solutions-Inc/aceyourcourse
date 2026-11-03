import { MARKETPLACES } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type {
  Exam,
  ExamPage,
  Faq,
  Product,
  Review,
  WebsiteSettings,
} from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Pure mappers between the Catalogue tables (src/lib/db/schema.ts) and the
// seam's types, both ways: rows → the seam's types for the database arm
// (catalogue.db.ts), and the seed → rows for `pnpm catalogue:seed`. No database
// access, so they are tested directly (catalogue.rows.test.ts), and the seed
// round-trips through them unchanged. Lists come back in `position` order,
// whatever order the rows arrive in.
// ─────────────────────────────────────────────────────────────────────────────

export type ExamRow = typeof schema.exams.$inferSelect;
export type SubjectRow = typeof schema.subjects.$inferSelect;
export type ProductRow = typeof schema.products.$inferSelect;
export type ProductSubjectRow = typeof schema.productSubjects.$inferSelect;
export type ProductVariationRow = typeof schema.productVariations.$inferSelect;
export type ProductPhotoRow = typeof schema.productPhotos.$inferSelect;
export type ProductListingRow = typeof schema.productListings.$inferSelect;
export type ReviewRow = typeof schema.reviews.$inferSelect;
export type FaqRow = typeof schema.faqs.$inferSelect;
export type ExamPageRow = typeof schema.examPages.$inferSelect;
export type WebsiteSettingsRow = typeof schema.websiteSettings.$inferSelect;
export type AnnouncementMessageRow = typeof schema.announcementMessages.$inferSelect;
export type PromoBannerRow = typeof schema.promoBanner.$inferSelect;

/** Every Catalogue table's rows, by table. */
export interface CatalogueRows {
  exams: ExamRow[];
  subjects: SubjectRow[];
  products: ProductRow[];
  productSubjects: ProductSubjectRow[];
  productVariations: ProductVariationRow[];
  productPhotos: ProductPhotoRow[];
  productListings: ProductListingRow[];
  reviews: ReviewRow[];
  faqs: FaqRow[];
  examPages: ExamPageRow[];
  websiteSettings: WebsiteSettingsRow[];
  announcementMessages: AnnouncementMessageRow[];
  promoBanner: PromoBannerRow[];
}

/** One part of the catalogue, as the seam's reads ask for it. */
export type CataloguePart = keyof CatalogueSeed;

/** The one Website settings row's id, and the promo banner's. */
export const SINGLE_ROW_ID = 1;

const byPosition = <T extends { position: number }>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => a.position - b.position);

/** The rows of each parent, by its key, in position order. */
function childrenBy<T extends { position: number }>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of byPosition(rows)) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

const isStars = (value: number): value is Review["stars"] =>
  Number.isInteger(value) && value >= 1 && value <= 5;

// ── Rows → the seam's types ─────────────────────────────────────────────────

export function examsFromRows(rows: Pick<CatalogueRows, "exams" | "subjects">): Exam[] {
  const subjectsOf = childrenBy(rows.subjects, (subject) => subject.examCode);
  return byPosition(rows.exams).map((exam) => ({
    code: exam.code,
    board: exam.board,
    name: exam.name,
    longName: exam.longName,
    blurb: exam.blurb,
    madeFor: exam.madeFor,
    subjects: (subjectsOf.get(exam.code) ?? []).map(({ code, name }) => ({ code, name })),
  }));
}

export function productsFromRows(
  rows: Pick<
    CatalogueRows,
    "products" | "productSubjects" | "productVariations" | "productPhotos" | "productListings"
  >,
): Product[] {
  const subjectsOf = childrenBy(rows.productSubjects, (row) => row.productId);
  const variationsOf = childrenBy(rows.productVariations, (row) => row.productId);
  const photosOf = childrenBy(rows.productPhotos, (row) => row.productId);

  return byPosition(rows.products).map((row) => {
    const listings: Product["listings"] = {};
    for (const marketplace of MARKETPLACES) {
      const listing = rows.productListings.find(
        (l) => l.productId === row.id && l.marketplace === marketplace,
      );
      if (listing) listings[marketplace] = listing.url;
    }
    const { shopeeRating, shopeeRatingCount, shopeeUnitsSold, shopeeAsOf } = row;
    const shopee =
      shopeeRating !== null &&
      shopeeRatingCount !== null &&
      shopeeUnitsSold !== null &&
      shopeeAsOf !== null
        ? {
            rating: shopeeRating,
            ratingCount: shopeeRatingCount,
            unitsSold: shopeeUnitsSold,
            asOf: shopeeAsOf,
          }
        : null;

    return {
      id: row.id,
      slug: row.slug,
      examCode: row.examCode,
      title: row.title,
      shortName: row.shortName,
      format: row.format,
      size: row.size,
      edition: row.edition,
      subjectCodes: (subjectsOf.get(row.id) ?? []).map((subject) => subject.subjectCode),
      state: row.state,
      priceFrom: row.priceFrom,
      priceTo: row.priceTo,
      variations: (variationsOf.get(row.id) ?? []).map(({ name, price }) => ({ name, price })),
      photos: (photosOf.get(row.id) ?? []).map(({ src, alt }) => ({ src, alt })),
      listings,
      shopee,
      deal: row.deal,
      availableInApp: row.availableInApp,
      showOnWebsite: row.showOnWebsite,
      whatsInside: row.whatsInside,
      madeFor: row.madeFor,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
    };
  });
}

export function reviewsFromRows(rows: readonly ReviewRow[]): Review[] {
  return byPosition(rows).map((row) => {
    if (!isStars(row.stars)) {
      throw new Error(`Review "${row.id}" has ${row.stars} stars; a Review has 1 to 5.`);
    }
    return {
      id: row.id,
      productId: row.productId,
      stars: row.stars,
      text: row.text,
      variation: row.variation,
      helpful: row.helpful,
      marketplace: row.marketplace,
      homePin: row.homePin,
    };
  });
}

export function faqsFromRows(rows: readonly FaqRow[]): Faq[] {
  return byPosition(rows).map((row) => ({
    id: row.id,
    slug: row.slug,
    group: row.group,
    order: row.order,
    question: row.question,
    answer: row.answer,
    // A deleted Review leaves its quote's text behind with no Review: no quote.
    reviewQuote:
      row.reviewQuoteReviewId !== null && row.reviewQuoteText !== null
        ? { reviewId: row.reviewQuoteReviewId, text: row.reviewQuoteText }
        : null,
    popularLabel: row.popularLabel,
    requiresMemberApp: row.requiresMemberApp,
    showOnFaqPage: row.showOnFaqPage,
    showCoverageTable: row.showCoverageTable,
  }));
}

export function examPagesFromRows(rows: readonly ExamPageRow[]): ExamPage[] {
  return byPosition(rows).map((row) => {
    const { bundleProductId, bundleHeadline, bundleText, bundleButtonLabel } = row;
    return {
      examCode: row.examCode,
      sections: {
        subjects: row.showSubjects,
        bundleOffer: row.showBundleOffer,
        reviews: row.showReviews,
      },
      // A deleted Product leaves its offer's copy behind with no Product: no offer.
      bundleOffer:
        bundleProductId !== null &&
        bundleHeadline !== null &&
        bundleText !== null &&
        bundleButtonLabel !== null
          ? {
              productId: bundleProductId,
              headline: bundleHeadline,
              text: bundleText,
              buttonLabel: bundleButtonLabel,
            }
          : null,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      shareImage: row.shareImage,
      officialExamDate: row.officialExamDate,
    };
  });
}

/** The Website settings. Throws when the catalogue has none, as before it is seeded. */
export function settingsFromRows(
  rows: Pick<CatalogueRows, "websiteSettings" | "announcementMessages" | "promoBanner">,
): Omit<WebsiteSettings, "memberAppLive"> {
  const [settings] = rows.websiteSettings;
  if (!settings) {
    throw new Error("The catalogue has no Website settings. Load it with `pnpm catalogue:seed`.");
  }
  const [promo] = rows.promoBanner;
  return {
    shopLinks: {
      shopee: settings.shopLinkShopee,
      lazada: settings.shopLinkLazada,
      tiktok: settings.shopLinkTiktok,
    },
    socialLinks: {
      tiktok: settings.socialTiktok,
      facebook: settings.socialFacebook,
      instagram: settings.socialInstagram,
    },
    contactEmail: settings.contactEmail,
    shopStats: {
      rating: settings.shopRating,
      ratingCount: settings.shopRatingCount,
      followers: settings.shopFollowers,
      asOf: settings.shopStatsAsOf,
    },
    announcement: {
      id: settings.announcementId,
      messages: byPosition(rows.announcementMessages).map(({ text, href, requiresMemberApp }) => ({
        text,
        href,
        requiresMemberApp,
      })),
    },
    promoBanner: promo
      ? {
          visible: promo.visible,
          text: promo.text,
          buttonLabel: promo.buttonLabel,
          href: promo.href,
          startDate: promo.startDate,
          endDate: promo.endDate,
        }
      : null,
  };
}

// ── The seed → rows ─────────────────────────────────────────────────────────

/** Every row of the seed, by table. Each list's order becomes its rows' positions. */
export function catalogueToRows(seed: CatalogueSeed): CatalogueRows {
  const { settings } = seed;
  return {
    exams: seed.exams.map((exam, position) => ({
      code: exam.code,
      position,
      board: exam.board,
      name: exam.name,
      longName: exam.longName,
      blurb: exam.blurb,
      madeFor: exam.madeFor,
    })),
    subjects: seed.exams.flatMap((exam) =>
      exam.subjects.map((subject, position) => ({
        examCode: exam.code,
        code: subject.code,
        position,
        name: subject.name,
      })),
    ),
    products: seed.products.map((product, position) => ({
      id: product.id,
      position,
      slug: product.slug,
      examCode: product.examCode,
      title: product.title,
      shortName: product.shortName,
      format: product.format,
      size: product.size,
      edition: product.edition,
      state: product.state,
      priceFrom: product.priceFrom,
      priceTo: product.priceTo,
      shopeeRating: product.shopee?.rating ?? null,
      shopeeRatingCount: product.shopee?.ratingCount ?? null,
      shopeeUnitsSold: product.shopee?.unitsSold ?? null,
      shopeeAsOf: product.shopee?.asOf ?? null,
      deal: product.deal,
      availableInApp: product.availableInApp,
      showOnWebsite: product.showOnWebsite,
      whatsInside: product.whatsInside,
      madeFor: product.madeFor,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
    })),
    productSubjects: seed.products.flatMap((product) =>
      product.subjectCodes.map((subjectCode, position) => ({
        productId: product.id,
        examCode: product.examCode,
        subjectCode,
        position,
      })),
    ),
    productVariations: seed.products.flatMap((product) =>
      product.variations.map(({ name, price }, position) => ({
        productId: product.id,
        position,
        name,
        price,
      })),
    ),
    productPhotos: seed.products.flatMap((product) =>
      product.photos.map(({ src, alt }, position) => ({
        productId: product.id,
        position,
        src,
        alt,
      })),
    ),
    productListings: seed.products.flatMap((product) =>
      MARKETPLACES.flatMap((marketplace) => {
        const url = product.listings[marketplace];
        return url === undefined ? [] : [{ productId: product.id, marketplace, url }];
      }),
    ),
    reviews: seed.reviews.map((review, position) => ({
      id: review.id,
      position,
      productId: review.productId,
      stars: review.stars,
      text: review.text,
      variation: review.variation,
      helpful: review.helpful,
      marketplace: review.marketplace,
      homePin: review.homePin,
    })),
    faqs: seed.faqs.map((faq, position) => ({
      id: faq.id,
      position,
      slug: faq.slug,
      group: faq.group,
      order: faq.order,
      question: faq.question,
      answer: faq.answer,
      reviewQuoteReviewId: faq.reviewQuote?.reviewId ?? null,
      reviewQuoteText: faq.reviewQuote?.text ?? null,
      popularLabel: faq.popularLabel,
      requiresMemberApp: faq.requiresMemberApp,
      showOnFaqPage: faq.showOnFaqPage,
      showCoverageTable: faq.showCoverageTable,
    })),
    examPages: seed.examPages.map((page, position) => ({
      examCode: page.examCode,
      position,
      showSubjects: page.sections.subjects,
      showBundleOffer: page.sections.bundleOffer,
      showReviews: page.sections.reviews,
      bundleProductId: page.bundleOffer?.productId ?? null,
      bundleHeadline: page.bundleOffer?.headline ?? null,
      bundleText: page.bundleOffer?.text ?? null,
      bundleButtonLabel: page.bundleOffer?.buttonLabel ?? null,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      shareImage: page.shareImage,
      officialExamDate: page.officialExamDate,
    })),
    websiteSettings: [
      {
        id: SINGLE_ROW_ID,
        shopLinkShopee: settings.shopLinks.shopee,
        shopLinkLazada: settings.shopLinks.lazada,
        shopLinkTiktok: settings.shopLinks.tiktok,
        socialTiktok: settings.socialLinks.tiktok,
        socialFacebook: settings.socialLinks.facebook,
        socialInstagram: settings.socialLinks.instagram,
        contactEmail: settings.contactEmail,
        shopRating: settings.shopStats.rating,
        shopRatingCount: settings.shopStats.ratingCount,
        shopFollowers: settings.shopStats.followers,
        shopStatsAsOf: settings.shopStats.asOf,
        announcementId: settings.announcement.id,
      },
    ],
    announcementMessages: settings.announcement.messages.map((message, position) => ({
      position,
      text: message.text,
      href: message.href,
      requiresMemberApp: message.requiresMemberApp,
    })),
    promoBanner: settings.promoBanner ? [{ id: SINGLE_ROW_ID, ...settings.promoBanner }] : [],
  };
}

/** Pure: the whole catalogue from every table's rows, as the seed holds it. */
export function catalogueFromRows(rows: CatalogueRows): CatalogueSeed {
  return {
    exams: examsFromRows(rows),
    settings: settingsFromRows(rows),
    products: productsFromRows(rows),
    reviews: reviewsFromRows(rows.reviews),
    faqs: faqsFromRows(rows.faqs),
    examPages: examPagesFromRows(rows.examPages),
  };
}
