import { z } from "zod";

import { isMarketplaceUrl, MARKETPLACE_HOSTS } from "@/lib/catalogue/store-links";
import { isCalendarDate } from "@/lib/manila-time";
import type {
  Exam,
  Faq,
  FaqGroup,
  Marketplace,
  Product,
  Review,
  WebsiteSettings,
} from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Validation for the Catalogue seed (docs/mockup/aycData.js ported to a typed
// seed today, the client's catalogue spreadsheet later). The mock validates its
// seed when it loads, so a bad edit fails loudly instead of rendering a broken
// Website. Rules that span records (an Exam a Product names, the Product a
// Review belongs to, the Review an FAQ quotes) are checked once the whole seed
// has been read.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything the seed holds. The Member App switch is not seed data: it comes
 * from the MEMBER_APP_LIVE environment variable, so it flips with no code change.
 */
export interface CatalogueSeed {
  exams: Exam[];
  settings: Omit<WebsiteSettings, "memberAppLive">;
  products: Product[];
  reviews: Review[];
  faqs: Faq[];
}

const nonBlank = (label: string) => z.string().trim().min(1, `${label} must not be blank`);

/** A YYYY-MM-DD date on the calendar: "2026-02-30" is rejected, not rolled over to 2 March. */
const isoDate = z.string().refine(isCalendarDate, "must be a real ISO date (YYYY-MM-DD)");

const httpsUrl = z
  .string()
  .url("must be a URL")
  .refine((value) => value.startsWith("https://"), "must be an https link");

/** An internal path ("/products") or an external https link. */
const href = z
  .string()
  .refine(
    (value) => (value.startsWith("/") && !value.startsWith("//")) || value.startsWith("https://"),
    "must be a path starting with / or an https link",
  );

/** Adds an issue at each item whose key was already seen earlier in the list. */
function flagDuplicates<T>(
  ctx: z.RefinementCtx,
  items: readonly T[],
  keyOf: (item: T) => string | number | null,
  issue: (item: T, index: number) => { path: (string | number)[]; message: string },
) {
  const seen = new Set<string | number>();
  items.forEach((item, index) => {
    const key = keyOf(item);
    if (key === null) return;
    if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue(item, index) });
    seen.add(key);
  });
}

const subjectSchema = z.object({
  code: nonBlank("Subject code"),
  name: nonBlank("Subject name"),
});

const examSchema = z.object({
  // Uppercase so every Exam has exactly one lowercase URL (/exams/ce).
  code: z.string().regex(/^[A-Z][A-Z0-9]*$/, "Exam code must be uppercase letters and digits"),
  board: nonBlank("Board"),
  name: nonBlank("Exam name"),
  longName: nonBlank("Exam long name"),
  blurb: nonBlank("Exam blurb"),
  madeFor: nonBlank("Made for"),
  subjects: z.array(subjectSchema).min(1, "an Exam needs at least one Subject"),
});

const examsSchema = z.array(examSchema).superRefine((exams, ctx) => {
  // Codes are looked up case-insensitively, so "CE" and "Ce" collide.
  flagDuplicates(
    ctx,
    exams,
    (exam) => exam.code.toUpperCase(),
    (exam, index) => ({ path: [index, "code"], message: `duplicate Exam code "${exam.code}"` }),
  );
});

/** Money in integer centavos. */
const centavos = z.number().int("must be whole centavos");

/** Photos are served from this site (public/ today, Storage later), never hot-linked. */
const selfHostedPath = z
  .string()
  .refine(
    (value) => value.startsWith("/") && !value.startsWith("//"),
    "must be a self-hosted path starting with /",
  );

const listingUrl = (marketplace: Marketplace) =>
  httpsUrl.refine(
    (value) => isMarketplaceUrl(value, marketplace),
    `must be a ${MARKETPLACE_HOSTS[marketplace].join(" or ")} link`,
  );

/** A URL part: a Product's /products/{slug}, an FAQ's #faq-{slug}. */
const kebabSlug = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "must be kebab-case: lowercase letters and digits joined by single hyphens",
  );

const productSchema = z
  .object({
    id: nonBlank("Product id"),
    slug: kebabSlug,
    examCode: nonBlank("Exam code"),
    title: nonBlank("Title"),
    shortName: nonBlank("Short name"),
    format: z.enum(["flash-cards", "notebook", "posters", "bundle"]),
    size: nonBlank("Size"),
    edition: nonBlank("Edition").nullable(),
    subjectCodes: z.array(nonBlank("Subject code")).min(1, "a Product covers at least one Subject"),
    state: z.enum(["live", "coming-soon"]),
    priceFrom: centavos.nullable(),
    priceTo: centavos.nullable(),
    variations: z.array(z.object({ name: nonBlank("Variation name"), price: centavos })),
    photos: z.array(z.object({ src: selfHostedPath, alt: nonBlank("Photo alt text") })),
    listings: z.object({
      shopee: listingUrl("shopee").optional(),
      lazada: listingUrl("lazada").optional(),
      tiktok: listingUrl("tiktok").optional(),
    }),
    shopee: z
      .object({
        rating: z.number().min(0).max(5),
        ratingCount: z.number().int().nonnegative(),
        unitsSold: z.number().int().nonnegative(),
        asOf: isoDate,
      })
      .nullable(),
    deal: z.boolean(),
    availableInApp: z.boolean(),
    showOnWebsite: z.boolean(),
    whatsInside: nonBlank("What's inside").nullable(),
    madeFor: z.array(nonBlank("Made for")).min(1).nullable(),
    seoTitle: nonBlank("SEO title").nullable(),
    seoDescription: nonBlank("SEO description").nullable(),
  })
  .superRefine((product, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

    if (product.state === "live") {
      if (product.priceFrom === null || product.priceFrom <= 0) {
        issue(["priceFrom"], "a Live Product needs a price above 0");
      } else if (product.priceTo !== null && product.priceTo < product.priceFrom) {
        issue(["priceTo"], "must not be below priceFrom");
      }
      product.variations.forEach((variation, index) => {
        if (variation.price <= 0) issue(["variations", index, "price"], "must be above 0");
      });
      if (product.photos.length === 0) issue(["photos"], "a Live Product needs at least one photo");
      return;
    }

    // Coming Soon: announced, not for sale, so nothing that implies a sale.
    if (product.priceFrom !== null) issue(["priceFrom"], "a Coming Soon Product has no price");
    if (product.priceTo !== null) issue(["priceTo"], "a Coming Soon Product has no price");
    if (product.variations.length > 0) {
      issue(["variations"], "a Coming Soon Product has no variations");
    }
    if (Object.keys(product.listings).length > 0) {
      issue(["listings"], "a Coming Soon Product has no Listings");
    }
    if (product.shopee !== null) issue(["shopee"], "a Coming Soon Product has no Shopee figures");
  });

const reviewSchema = z.object({
  id: nonBlank("Review id"),
  productId: nonBlank("Product id"),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)], {
    errorMap: () => ({ message: "must be a whole number of stars from 1 to 5" }),
  }),
  text: nonBlank("Review text"),
  variation: nonBlank("Variation").nullable(),
  helpful: z.number().int().nonnegative(),
  marketplace: z.enum(["shopee", "lazada", "tiktok"]),
  homePin: z.number().int().positive("must be a positive whole number").nullable(),
});

/** The FAQ page's fixed groups, in page order. */
export const FAQ_GROUPS = [
  "shipping",
  "paper",
  "coverage",
  "buying",
  "authenticity",
] as const satisfies readonly FaqGroup[];

/** The Admin's limit, so every answer stays short. */
const FAQ_ANSWER_MAX = 400;

const faqSchema = z.object({
  id: nonBlank("FAQ id"),
  slug: kebabSlug,
  group: z.enum(FAQ_GROUPS),
  order: z.number().int().nonnegative(),
  question: nonBlank("Question"),
  answer: nonBlank("Answer").max(FAQ_ANSWER_MAX, `must be at most ${FAQ_ANSWER_MAX} characters`),
  reviewQuote: z.object({ reviewId: nonBlank("Review id"), text: nonBlank("Quote") }).nullable(),
  popularLabel: nonBlank("Popular label").nullable(),
  requiresMemberApp: z.boolean(),
  showOnFaqPage: z.boolean(),
  showCoverageTable: z.boolean(),
});

const promoBannerSchema = z
  .object({
    visible: z.boolean(),
    text: nonBlank("Promo text"),
    buttonLabel: nonBlank("Promo button label"),
    href,
    startDate: isoDate,
    endDate: isoDate,
  })
  // A date that isn't real has its own error, so only two real dates are compared.
  .refine(
    (banner) =>
      !isCalendarDate(banner.startDate) ||
      !isCalendarDate(banner.endDate) ||
      banner.endDate >= banner.startDate,
    { path: ["endDate"], message: "must not be before startDate" },
  );

const settingsSchema = z.object({
  shopLinks: z.object({
    shopee: httpsUrl.nullable(),
    lazada: httpsUrl.nullable(),
    tiktok: httpsUrl.nullable(),
  }),
  socialLinks: z.object({
    tiktok: httpsUrl.nullable(),
    facebook: httpsUrl.nullable(),
    instagram: httpsUrl.nullable(),
  }),
  contactEmail: z.string().email("must be an email address"),
  shopStats: z.object({
    rating: z.number().min(0).max(5),
    ratingCount: z.number().int().nonnegative(),
    followers: nonBlank("Followers"),
    asOf: isoDate,
  }),
  announcement: z.object({
    id: nonBlank("Announcement id"),
    messages: z.array(
      z.object({
        text: nonBlank("Announcement text"),
        href,
        requiresMemberApp: z.boolean(),
      }),
    ),
  }),
  promoBanner: promoBannerSchema.nullable(),
});

export const catalogueSeedSchema: z.ZodType<CatalogueSeed> = z
  .object({
    exams: examsSchema,
    settings: settingsSchema,
    products: z.array(productSchema),
    reviews: z.array(reviewSchema),
    faqs: z.array(faqSchema),
  })
  .superRefine(({ exams, products, reviews, faqs }, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

    flagDuplicates(
      ctx,
      products,
      (product) => product.id,
      (product, index) => ({
        path: ["products", index, "id"],
        message: `duplicate Product id "${product.id}"`,
      }),
    );
    flagDuplicates(
      ctx,
      products,
      (product) => product.slug,
      (product, index) => ({
        path: ["products", index, "slug"],
        message: `duplicate slug "${product.slug}"`,
      }),
    );
    products.forEach((product, index) => {
      const exam = exams.find((e) => e.code === product.examCode);
      if (!exam) {
        issue(["products", index, "examCode"], `unknown Exam "${product.examCode}"`);
        return;
      }
      product.subjectCodes.forEach((code, subjectIndex) => {
        if (!exam.subjects.some((subject) => subject.code === code)) {
          issue(
            ["products", index, "subjectCodes", subjectIndex],
            `"${code}" is not a Subject of ${exam.code}`,
          );
        }
      });
    });

    flagDuplicates(
      ctx,
      reviews,
      (review) => review.id,
      (review, index) => ({
        path: ["reviews", index, "id"],
        message: `duplicate Review id "${review.id}"`,
      }),
    );
    flagDuplicates(
      ctx,
      reviews,
      (review) => review.homePin,
      (review, index) => ({
        path: ["reviews", index, "homePin"],
        message: `duplicate homePin ${review.homePin}`,
      }),
    );
    reviews.forEach((review, index) => {
      const product = products.find((p) => p.id === review.productId);
      if (!product) {
        issue(["reviews", index, "productId"], `unknown Product "${review.productId}"`);
      } else if (product.state !== "live") {
        issue(["reviews", index, "productId"], "a Coming Soon Product has no Reviews");
      }
    });

    flagDuplicates(
      ctx,
      faqs,
      (faq) => faq.id,
      (faq, index) => ({ path: ["faqs", index, "id"], message: `duplicate FAQ id "${faq.id}"` }),
    );
    flagDuplicates(
      ctx,
      faqs,
      (faq) => faq.slug,
      (faq, index) => ({
        path: ["faqs", index, "slug"],
        message: `duplicate slug "${faq.slug}"`,
      }),
    );
    flagDuplicates(
      ctx,
      faqs,
      (faq) => `${faq.group}:${faq.order}`,
      (faq, index) => ({
        path: ["faqs", index, "order"],
        message: `order ${faq.order} is already used in ${faq.group}`,
      }),
    );
    flagDuplicates(
      ctx,
      faqs,
      (faq) => (faq.showCoverageTable ? "coverage table" : null),
      (_faq, index) => ({
        path: ["faqs", index, "showCoverageTable"],
        message: "only one FAQ can show the coverage table",
      }),
    );
    // A quote is shown as "From a review", so it must be a real one.
    faqs.forEach((faq, index) => {
      if (!faq.reviewQuote) return;
      const { reviewId, text } = faq.reviewQuote;
      const review = reviews.find((r) => r.id === reviewId);
      if (!review) {
        issue(["faqs", index, "reviewQuote", "reviewId"], `unknown Review "${reviewId}"`);
      } else if (!review.text.includes(text)) {
        issue(
          ["faqs", index, "reviewQuote", "text"],
          `must be word for word from Review "${reviewId}"`,
        );
      }
    });
  });

export type CatalogueSeedValidation =
  { success: true; data: CatalogueSeed } | { success: false; errors: string[] };

/**
 * Pure: validate a seed. On failure, returns one readable error per problem,
 * each naming the field, e.g. `exams.1.code: duplicate Exam code "CE"`.
 */
export function validateCatalogueSeed(seed: unknown): CatalogueSeedValidation {
  const result = catalogueSeedSchema.safeParse(seed);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  };
}
