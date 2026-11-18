import { z } from "zod";

import { parsePeso } from "@/lib/admin/peso";
import { fullTitle, WHOLE_TITLE_MAX } from "@/lib/admin/seo-check";
import {
  ABOUT_ALT_MAX,
  ABOUT_LIMITS,
  ABOUT_PHOTO_SLOTS,
  ABOUT_SPEC_MAX,
} from "@/lib/catalogue/about-content";
import { isMarketplaceUrl, isOnHost } from "@/lib/catalogue/store-links";
import { isCalendarDate } from "@/lib/manila-time";
import { variationLabel } from "@/lib/catalogue/price";
import type { AdminError, RequiredRole, StaffActor } from "@/services/admin.types";
import { IMPORT_MODES } from "@/lib/card-import/modes";
import { cardFieldProblems, cardFieldsOf } from "@/lib/cards/card-fields";
import type { ContentCounts, TopicContent } from "@/services/content.types";
import {
  EXAM_PAGE_SECTIONS,
  FAQ_ANSWER_MAX,
  FAQ_GROUPS,
  httpsUrl,
  isSiteHref,
  MAX_EXAMS,
  PRODUCT_FORMATS,
  SITE_PAGES,
} from "@/services/catalogue.schema";
import type {
  AboutContent,
  AboutSectionKey,
  Marketplace,
  Review,
} from "@/services/catalogue.types";

// The Admin seam's zod input schemas (CONVENTIONS §3), shared by the seam's
// arms, the Staff Guard and the forms.

/** A sign-in email: trimmed and lowercased, because the staff list compares emails case-insensitively. */
export const staffEmailSchema = z.string().trim().toLowerCase().email();

const MISSING_EMAIL = "Enter an email address.";

/** A typed email, trimmed, with one message for an empty or a malformed one. */
const typedEmail = z
  .string({ required_error: MISSING_EMAIL, invalid_type_error: MISSING_EMAIL })
  .trim()
  .min(1, MISSING_EMAIL)
  .pipe(z.string().email("Enter a valid email address, like name@example.com."));

/** The "Sign in as" form's "Other email" (sample mode). */
export const signInAsSchema = z.object({ email: typedEmail });

const MISSING_SIGN_IN_EMAIL = "Enter your email";
const MISSING_PASSWORD = "Enter your password";

/**
 * The development password box (ticket 19): a typed email and a password.
 * The password is taken exactly as typed; Supabase checks it.
 */
export const passwordSignInSchema = z.object({
  email: z
    .string({ required_error: MISSING_SIGN_IN_EMAIL, invalid_type_error: MISSING_SIGN_IN_EMAIL })
    .trim()
    .min(1, MISSING_SIGN_IN_EMAIL)
    .pipe(typedEmail),
  password: z
    .string({ required_error: MISSING_PASSWORD, invalid_type_error: MISSING_PASSWORD })
    .min(1, MISSING_PASSWORD),
});

/** A typed email for the staff list, which stores emails lowercase. */
const typedStaffEmail = typedEmail.transform((email) => email.toLowerCase());

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * Pure: a refused input's messages by field, keyed by the field's dotted path
 * ("shopLinks.lazada"), the same name the form gives the field.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field) (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

/**
 * Pure: the refusal for an actor without the Staff Role a write needs, or null
 * when they have it. Both the Server Action and the seam check (CONVENTIONS §3).
 */
export function roleRefusal(
  actor: StaffActor,
  role: RequiredRole,
  message = "ONLY AN OWNER CAN DO THIS",
): AdminError | null {
  return role === "owner" && actor.role !== "owner" ? { kind: "forbidden", message } : null;
}

/**
 * Pure: the "invalid" AdminError for a refused input: each field's messages,
 * and the message that isn't about one field, if there is one.
 */
export function invalidInput(error: z.ZodError): AdminError {
  const formError = error.issues.find((issue) => issue.path.length === 0)?.message;
  return {
    kind: "invalid",
    fieldErrors: fieldErrorsOf(error),
    ...(formError ? { formError } : {}),
  };
}

// ── Settings ────────────────────────────────────────────────────────────────
// The Website's contact email, shop and social links, and shop-wide trust
// figures (spec, Phase 2 → Settings), with the mockup's messages (BUILD-MAP
// §3.11). Every field takes the form's text as well as typed values, so the
// Server Action and the seam parse with the same schema.

/**
 * A link as typed: trimmed, empty as null (which hides that button or link on
 * the Website), and with https:// put in front when it was typed without a
 * scheme or with http://, as in the mockup's "shopee.ph/aceyourcourse".
 */
function typedLink(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const link = value.trim();
  if (!link) return null;
  return /^https?:\/\//i.test(link) ? link.replace(/^https?:\/\//i, "https://") : `https://${link}`;
}

/** A link on one of these hosts, or none. */
const linkOn = (isRight: (link: string) => boolean, message: string) =>
  z.preprocess(
    typedLink,
    z
      .string({ invalid_type_error: message, required_error: message })
      .refine((link) => httpsUrl.safeParse(link).success && isRight(link), message)
      .nullable(),
  );

const shopLink = (marketplace: Marketplace, message: string) =>
  linkOn((link) => isMarketplaceUrl(link, marketplace), message);

/** A TikTok profile: tiktok.com/@name. */
const isTikTokProfile = (link: string) =>
  isOnHost(link, ["tiktok.com"]) && /^\/@[\w.-]+\/?$/.test(new URL(link).pathname);

/** A typed number: the form's text, with any thousands commas, or a number. */
function typedNumber(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim().replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

const RATING = "ENTER A RATING FROM 0 TO 5, WITH ONE DECIMAL AT MOST";
const COUNT = "ENTER A WHOLE NUMBER, 0 OR MORE";
const FOLLOWERS = "ENTER THE FOLLOWERS AS SHOPEE SHOWS THEM, LIKE 3.7K";
const EMAIL = "ENTER A VALID EMAIL ADDRESS";

/** At most one decimal: 4.8, not 4.85. */
const hasOneDecimalAtMost = (value: number) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;

/** The contact email, shown on the Website's footer, FAQ, product and legal pages. */
export const contactSettingsSchema = z.object({
  contactEmail: z.string({ invalid_type_error: EMAIL, required_error: EMAIL }).trim().email(EMAIL),
});

/** What a link on the wrong host is told, for each Marketplace's shop pages and Listings. */
const MARKETPLACE_LINK: Record<Marketplace, string> = {
  shopee: "SHOULD BE A SHOPEE.PH LINK",
  lazada: "SHOULD BE A LAZADA.COM.PH LINK",
  tiktok: "SHOULD BE A TIKTOK LINK",
};

/** Each Marketplace's shop page and the social profiles. An empty one is hidden. */
export const linkSettingsSchema = z.object({
  shopLinks: z.object({
    shopee: shopLink("shopee", MARKETPLACE_LINK.shopee),
    lazada: shopLink("lazada", MARKETPLACE_LINK.lazada),
    tiktok: shopLink("tiktok", MARKETPLACE_LINK.tiktok),
  }),
  socialLinks: z.object({
    tiktok: linkOn(isTikTokProfile, "SHOULD LOOK LIKE TIKTOK.COM/@NAME"),
    facebook: linkOn((link) => isOnHost(link, ["facebook.com"]), "SHOULD BE A FACEBOOK.COM LINK"),
    instagram: linkOn(
      (link) => isOnHost(link, ["instagram.com"]),
      "SHOULD BE AN INSTAGRAM.COM LINK",
    ),
  }),
});

/** The shop-wide Shopee figures. Saving them sets their "as of" date. */
export const trustFiguresSchema = z.object({
  shopStats: z.object({
    rating: z.preprocess(
      typedNumber,
      z
        .number({ invalid_type_error: RATING, required_error: RATING })
        .min(0, RATING)
        .max(5, RATING)
        .refine(hasOneDecimalAtMost, RATING),
    ),
    ratingCount: z.preprocess(
      typedNumber,
      z.number({ invalid_type_error: COUNT, required_error: COUNT }).int(COUNT).nonnegative(COUNT),
    ),
    followers: z
      .string({ invalid_type_error: FOLLOWERS, required_error: FOLLOWERS })
      .trim()
      .min(1, FOLLOWERS)
      .max(20, FOLLOWERS),
  }),
});

/**
 * A Settings save: any of its parts, each whole. Anything else in the input,
 * such as the announcement, is dropped.
 */
export const websiteSettingsUpdateSchema = contactSettingsSchema
  .merge(linkSettingsSchema)
  .merge(trustFiguresSchema)
  .partial()
  .refine((update) => Object.keys(update).length > 0, "NOTHING TO SAVE");

export type WebsiteSettingsUpdate = z.infer<typeof websiteSettingsUpdateSchema>;

// ── Staff and Invites ───────────────────────────────────────────────────────
// Owners manage who can use the Admin (spec, Phase 2 → Invites, Staff Role
// permissions). Emails are stored lowercase, because the staff list compares
// them case-insensitively.

const ROLE = "Choose Editor or Owner.";
const staffRoleSchema = z.enum(["owner", "editor"], {
  errorMap: () => ({ message: ROLE }),
});

/** An email on the staff list, and a Staff Role for it. */
const staffEmailAndRoleSchema = z.object({ email: typedStaffEmail, role: staffRoleSchema });

/** "+ Authorise an account": a Google email and the Staff Role it gets. */
export const inviteStaffSchema = staffEmailAndRoleSchema;

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

/** The Staff User or Invite an action is for (Renew, Cancel invite, Remove). */
export const staffEmailInputSchema = z.object({ email: typedStaffEmail });

/** Change role: an active Staff User and their new Staff Role. */
export const changeStaffRoleSchema = staffEmailAndRoleSchema;

export type ChangeStaffRoleInput = z.infer<typeof changeStaffRoleSchema>;

/** A Beta Tester's Google email, as the Beta Testers tab sends it: stored lowercase. */
export const betaTesterInputSchema = staffEmailInputSchema;

export type BetaTesterInput = z.input<typeof betaTesterInputSchema>;

// ── Products ────────────────────────────────────────────────────────────────

const flag = z.boolean({
  invalid_type_error: "SHOULD BE ON OR OFF",
  required_error: "SHOULD BE ON OR OFF",
});

const productFlagFields = z.object({
  showOnWebsite: flag.optional(),
  availableInApp: flag.optional(),
});

/** A single toggle on a Product: "Show on website", "Available in app", or both. */
export type ProductFlags = z.infer<typeof productFlagFields>;

const hasAFlag = (flags: ProductFlags) =>
  flags.showOnWebsite !== undefined || flags.availableInApp !== undefined;

/** A single toggle's flags, at least one of them. */
export const productFlagsSchema = productFlagFields.refine(hasAFlag, "NOTHING TO SAVE");

/** The Products list's toggle, as its Server Action takes it: the Product and its flags. */
export const productFlagsInputSchema = productFlagFields
  .extend({ id: z.string().trim().min(1).max(100) })
  .refine(hasAFlag, "NOTHING TO SAVE");

export type ProductFlagsInput = z.infer<typeof productFlagsInputSchema>;

// ── The Product editor ──────────────────────────────────────────────────────
// A Product's fields as the editor's form holds them: text as typed, prices in
// pesos, the Shopee figures as three fields, Made for one per line (spec,
// Phase 2 → Products; BUILD-MAP §3.3, Editor panel). The Server Actions check
// only this shape; the seam parses it with every rule, so each arm refuses
// the same input with the same messages, all of them at once. The page
// address isn't here: it's set when a Product is created. The photos are in
// order, the first the cover, each one a photo the Product has (its src) or a
// new upload (its path from the upload seam). Rules that need the catalogue
// (the Exam's Subjects, the photos, Reviews) are the seam's.

/** The Website's limits for a search result's title and description (product-copy.ts). */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

/** What a Live Product with no photo is told. */
export const PHOTO_TO_GO_LIVE = "A Live Product needs at least one photo.";

/** What a save with a photo whose file hasn't arrived yet is told. */
export const WAIT_FOR_UPLOADS = "Wait for uploads to finish.";

/** What a photo that's neither the Product's nor a finished upload is told. */
export const PHOTO_NOT_UPLOADED = "A PHOTO ISN’T UPLOADED · ADD IT AGAIN";

/** The most photos a Product can have. */
export const MAX_PRODUCT_PHOTOS = 20;

const LISTING_MARKETPLACES = [
  "shopee",
  "lazada",
  "tiktok",
] as const satisfies readonly Marketplace[];

const NAME_AND_PRICE = "ADD A NAME AND PRICE TO SAVE";
const NAME_ONLY = "ADD A NAME TO SAVE";
const SHOPEE_FIGURES = "Fill in all three Shopee figures, or none.";

const formText = (max: number) =>
  z
    .string({ invalid_type_error: "SHOULD BE TEXT", required_error: "SHOULD BE TEXT" })
    .max(max, `KEEP IT TO ${max} CHARACTERS`);

const productFormFields = z.object({
  title: formText(120),
  shortName: formText(60),
  edition: formText(40),
  examCode: formText(10),
  format: z.enum(PRODUCT_FORMATS, { errorMap: () => ({ message: "CHOOSE A FORMAT" }) }),
  size: formText(80),
  subjectCodes: z.array(formText(40)).max(30),
  photos: z.array(formText(300)).max(MAX_PRODUCT_PHOTOS, `KEEP IT TO ${MAX_PRODUCT_PHOTOS} PHOTOS`),
  comingSoon: flag,
  deal: flag,
  priceFrom: formText(30),
  priceTo: formText(30),
  variations: z.array(z.object({ name: formText(120), price: formText(30) })).max(30),
  shopee: z.object({ rating: formText(10), ratingCount: formText(15), unitsSold: formText(15) }),
  whatsInside: formText(1000),
  madeFor: formText(1000),
  listings: z.object({ shopee: formText(500), lazada: formText(500), tiktok: formText(500) }),
  // Longer than the limits, so an over-long one is told the limit by the rules below.
  seoTitle: formText(500),
  seoDescription: formText(1000),
});

/** The Product editor's values, as its form holds them and its Server Actions send them. */
export type ProductForm = z.infer<typeof productFormFields>;

/** The flags a new Product is added with. An existing one's are single toggles. */
const newProductFlags = z.object({ showOnWebsite: flag, availableInApp: flag });

/** A new Product's values: the editor's, and its "Show on website" and "Available in app". */
export type NewProductForm = ProductForm & z.infer<typeof newProductFlags>;

/** Pure: a typed count of ratings or units sold, or NaN when it isn't one. */
const countOf = (text: string) => {
  const value = typedNumber(text);
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : Number.NaN;
};

const blank = (text: string) => text.trim() === "";
const textOrNull = (text: string) => text.trim() || null;
const centavosOf = (text: string) => {
  const parsed = parsePeso(text);
  return parsed.ok ? parsed.centavos : null;
};

/** Every rule on the typed values, each on its own field, plus the form's message. */
function checkProductForm(form: ProductForm, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  /** A price field's centavos, after adding its message if it isn't a price. */
  const price = (path: (string | number)[], text: string) => {
    const parsed = parsePeso(text);
    if (!parsed.ok) issue(path, parsed.message);
    return parsed.ok ? parsed.centavos : undefined;
  };

  if (blank(form.title)) issue(["title"], "ADD A NAME");
  if (blank(form.shortName)) issue(["shortName"], "ADD A SHORT NAME FOR CARDS");
  if (blank(form.examCode)) issue(["examCode"], "CHOOSE AN EXAM");
  if (blank(form.size)) issue(["size"], "ADD THE SIZE AND PAPER");
  if (!form.subjectCodes.some((code) => !blank(code))) {
    issue(["subjectCodes"], "CHOOSE AT LEAST ONE SUBJECT");
  }
  if (form.seoTitle.trim().length > SEO_TITLE_MAX) {
    issue(["seoTitle"], `KEEP IT TO ${SEO_TITLE_MAX} CHARACTERS`);
  }
  if (form.seoDescription.trim().length > SEO_DESCRIPTION_MAX) {
    issue(["seoDescription"], `KEEP IT TO ${SEO_DESCRIPTION_MAX} CHARACTERS`);
  }
  madeForLines(form.madeFor).forEach((line, index) => {
    if (line.length > 120) issue(["madeFor"], `KEEP LINE ${index + 1} TO 120 CHARACTERS`);
  });

  // Coming Soon: nothing that implies a sale is saved, so none of it is checked.
  if (form.comingSoon) {
    if (blank(form.title)) issue([], NAME_ONLY);
    return;
  }

  const from = price(["priceFrom"], form.priceFrom);
  if (from === null) issue(["priceFrom"], "ADD A PRICE");
  else if (from === 0) issue(["priceFrom"], "ENTER A PRICE ABOVE ₱0");
  if (blank(form.title) || from === null) issue([], NAME_AND_PRICE);

  const to = price(["priceTo"], form.priceTo);
  if (typeof to === "number" && typeof from === "number" && to < from) {
    issue(["priceTo"], "SHOULD NOT BE BELOW THE PRICE FROM");
  }

  form.variations.forEach((variation, index) => {
    if (blank(variationLabel(variation.name))) issue(["variations", index, "name"], "ADD A NAME");
    const centavos = price(["variations", index, "price"], variation.price);
    if (centavos === null) issue(["variations", index, "price"], "ADD A PRICE");
    else if (centavos === 0) issue(["variations", index, "price"], "ENTER A PRICE ABOVE ₱0");
  });

  const figures = form.shopee;
  const filled = [figures.rating, figures.ratingCount, figures.unitsSold].filter((t) => !blank(t));
  if (filled.length > 0 && filled.length < 3) {
    (["rating", "ratingCount", "unitsSold"] as const).forEach((field) => {
      if (blank(figures[field])) issue(["shopee", field], SHOPEE_FIGURES);
    });
  }
  if (!blank(figures.rating)) {
    const rating = typedNumber(figures.rating);
    if (
      typeof rating !== "number" ||
      !(rating >= 0 && rating <= 5) ||
      !hasOneDecimalAtMost(rating)
    ) {
      issue(["shopee", "rating"], RATING);
    }
  }
  if (!blank(figures.ratingCount) && Number.isNaN(countOf(figures.ratingCount))) {
    issue(["shopee", "ratingCount"], COUNT);
  }
  if (!blank(figures.unitsSold) && Number.isNaN(countOf(figures.unitsSold))) {
    issue(["shopee", "unitsSold"], COUNT);
  }

  LISTING_MARKETPLACES.forEach((marketplace) => {
    const link = typedLink(form.listings[marketplace]);
    if (link === null) return;
    const valid =
      typeof link === "string" &&
      httpsUrl.safeParse(link).success &&
      isMarketplaceUrl(link, marketplace);
    if (!valid) issue(["listings", marketplace], MARKETPLACE_LINK[marketplace]);
  });
}

/** Pure: "Made for · one per line" as its lines, trimmed, blank ones dropped. */
function madeForLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Pure: a checked form as the Product's fields. A Coming Soon Product drops its sale fields. */
function toProductInput(form: ProductForm) {
  const comingSoon = form.comingSoon;
  const figures = form.shopee;
  const hasFigures = !comingSoon && !blank(figures.rating);
  const listings: Partial<Record<Marketplace, string>> = {};
  if (!comingSoon) {
    for (const marketplace of LISTING_MARKETPLACES) {
      const link = typedLink(form.listings[marketplace]);
      if (typeof link === "string") listings[marketplace] = link;
    }
  }
  const lines = madeForLines(form.madeFor);
  return {
    title: form.title.trim(),
    shortName: form.shortName.trim(),
    edition: textOrNull(form.edition),
    examCode: form.examCode.trim().toUpperCase(),
    format: form.format,
    size: form.size.trim(),
    subjectCodes: [...new Set(form.subjectCodes.map((code) => code.trim()).filter(Boolean))],
    /** The photos' srcs and upload paths, in order; the seam resolves them. */
    photos: [...new Set(form.photos.map((photo) => photo.trim()).filter(Boolean))],
    state: comingSoon ? ("coming-soon" as const) : ("live" as const),
    deal: form.deal,
    priceFrom: comingSoon ? null : centavosOf(form.priceFrom),
    priceTo: comingSoon ? null : centavosOf(form.priceTo),
    variations: comingSoon
      ? []
      : form.variations.map((variation) => ({
          name: variation.name.trim(),
          price: centavosOf(variation.price) ?? 0,
        })),
    shopee: hasFigures
      ? {
          rating: Number(typedNumber(figures.rating)),
          ratingCount: countOf(figures.ratingCount),
          unitsSold: countOf(figures.unitsSold),
        }
      : null,
    listings,
    whatsInside: textOrNull(form.whatsInside),
    madeFor: lines.length > 0 ? lines : null,
    seoTitle: textOrNull(form.seoTitle),
    seoDescription: textOrNull(form.seoDescription),
  };
}

/** The Product editor's form, checked against every rule and read as the Product's fields. */
export const productFormSchema = productFormFields
  .superRefine(checkProductForm)
  .transform(toProductInput);

/** A Product's fields, as the seam saves them. The "as of" date is set by the seam. */
export type ProductInput = z.output<typeof productFormSchema>;

/** A new Product's form, checked, with its two flags. */
export const newProductFormSchema = productFormFields
  .merge(newProductFlags)
  .superRefine(checkProductForm)
  .transform(({ showOnWebsite, availableInApp, ...form }) => ({
    ...toProductInput(form),
    showOnWebsite,
    availableInApp,
  }));

const productId = z.string().trim().min(1).max(100);

/** "Add product": the new Product's form, its shape checked (the seam checks the rules). */
export const addProductInputSchema = productFormFields.merge(newProductFlags);

/** "Save product": the Product and its form, its shape checked (the seam checks the rules). */
export const saveProductInputSchema = productFormFields.extend({ id: productId });

/** The Product a delete, or its preview, is for. */
export const productIdInputSchema = z.object({ id: productId });

// ── Reviews ─────────────────────────────────────────────────────────────────
// A Review's fields as the editor's form holds them: the stars it was clicked
// to, the text as pasted, the Product's id, the variation ("" when it isn't
// specified), the Marketplace and the helpful votes as typed (spec, Phase 2 →
// Reviews; BUILD-MAP §3.4, Editor). As with Products, the Server Actions
// check only this shape and the seam parses it with every rule. Rules that
// need the catalogue (a Live Product, one of its variations, the FAQ quotes
// taken from the Review) are the seam's. "Pin on Home" is a single toggle on
// an existing Review, so only a new Review's form carries it.

/** What a Review with no text is told, on the save-state line. */
export const REVIEW_TEXT_TO_SAVE = "PASTE THE REVIEW TEXT TO SAVE";

const STARS = "CHOOSE 1 TO 5 STARS";

/** Pure: whether a number is a Review's stars, a whole 1 to 5. */
export const isReviewStars = (stars: number): stars is Review["stars"] =>
  Number.isInteger(stars) && stars >= 1 && stars <= 5;

const reviewFormFields = z.object({
  stars: z.number({ invalid_type_error: STARS, required_error: STARS }),
  text: formText(5000),
  productId: formText(100),
  variation: formText(200),
  marketplace: z.enum(LISTING_MARKETPLACES, { errorMap: () => ({ message: "CHOOSE A STORE" }) }),
  helpful: formText(15),
});

/** The Review editor's values, as its form holds them and its Server Actions send them. */
export type ReviewForm = z.infer<typeof reviewFormFields>;

const newReviewPin = z.object({ pinned: flag });

/** A new Review's values: the editor's, and whether it's pinned on Home. */
export type NewReviewForm = ReviewForm & z.infer<typeof newReviewPin>;

/** Every rule on the typed values, each on its own field, plus the form's message. */
function checkReviewForm(form: ReviewForm, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  if (blank(form.text)) {
    issue(["text"], "PASTE THE REVIEW TEXT");
    issue([], REVIEW_TEXT_TO_SAVE);
  }
  if (!isReviewStars(form.stars)) issue(["stars"], STARS);
  if (blank(form.productId)) issue(["productId"], "CHOOSE A PRODUCT");
  if (!blank(form.helpful) && Number.isNaN(countOf(form.helpful))) issue(["helpful"], COUNT);
}

/**
 * Pure: a checked form as the Review's fields. The text keeps its words and
 * line breaks; only the space around it, and Windows line endings, go.
 */
function toReviewInput(form: ReviewForm) {
  // Called once checkReviewForm has passed, so the stars are 1 to 5.
  if (!isReviewStars(form.stars)) throw new Error(`${form.stars} isn't a number of stars`);
  return {
    stars: form.stars,
    text: form.text.replace(/\r\n?/g, "\n").trim(),
    productId: form.productId.trim(),
    variation: textOrNull(form.variation),
    marketplace: form.marketplace,
    helpful: blank(form.helpful) ? 0 : countOf(form.helpful),
  };
}

/** The Review editor's form, checked against every rule and read as the Review's fields. */
export const reviewFormSchema = reviewFormFields
  .superRefine(checkReviewForm)
  .transform(toReviewInput);

/** A Review's fields, as the seam saves them. Its id and Home pin are the seam's. */
export type ReviewInput = z.output<typeof reviewFormSchema>;

/** A new Review's form, checked, with its pin. */
export const newReviewFormSchema = reviewFormFields
  .merge(newReviewPin)
  .superRefine(checkReviewForm)
  .transform(({ pinned, ...form }) => ({ ...toReviewInput(form), pinned }));

const reviewId = z.string().trim().min(1).max(100);

/** "Add review": the new Review's form, its shape checked (the seam checks the rules). */
export const addReviewInputSchema = reviewFormFields.merge(newReviewPin);

/** "Save review": the Review and its form, its shape checked (the seam checks the rules). */
export const saveReviewInputSchema = reviewFormFields.extend({ id: reviewId });

/** The Review a delete, or its preview, is for. */
export const reviewIdInputSchema = z.object({ id: reviewId });

/** The HOME switch, a single toggle: pinned or not. */
export const reviewPinSchema = z.object({ pinned: flag });

/** The HOME switch, as its Server Action takes it: the Review and its pin. */
export const reviewPinInputSchema = reviewPinSchema.extend({ id: reviewId });

/** ▲ or ▼: one place earlier or later in the Home order. */
export const reviewMoveSchema = z.object({
  direction: z.enum(["up", "down"], { errorMap: () => ({ message: "SHOULD BE UP OR DOWN" }) }),
});

export type ReviewMove = z.infer<typeof reviewMoveSchema>["direction"];

/** ▲▼, as its Server Action takes it: the Review and the way it moves. */
export const reviewMoveInputSchema = reviewMoveSchema.extend({ id: reviewId });

// ── FAQs ────────────────────────────────────────────────────────────────────
// An FAQ's fields as the editor's form holds them: the question and answer as
// typed, its group, the supporting quote as the Review's id and the words
// taken from it ("" for none), Popular with its chip label, and the toggles
// (spec, Phase 2 → FAQ; BUILD-MAP §3.4, FAQS tab). As with Reviews, the
// Server Actions check only this shape and the seam parses it with every
// rule. Rules that need the catalogue (the quote is in its Review word for
// word, from a Review shown on the Website; one question shows the Subjects
// table) are the seam's. The deep link and the place in the group are the
// seam's too.

/** What an FAQ missing its question or answer is told, on the save-state line. */
export const QUESTION_AND_ANSWER_TO_SAVE = "WRITE A QUESTION AND ANSWER TO SAVE";

/** What a quote that isn't in its Review word for word is told. */
export const QUOTE_NOT_WORD_FOR_WORD = "This text isn’t in the Review word for word.";

/** The longest popular-question chip label. */
export const FAQ_CHIP_LABEL_MAX = 40;

const faqFormFields = z.object({
  question: formText(300),
  // Longer than the limits, so an over-long one is told the limit by the rules below.
  answer: formText(5000),
  group: z.enum(FAQ_GROUPS, { errorMap: () => ({ message: "CHOOSE A GROUP" }) }),
  quoteReviewId: formText(100),
  quoteText: formText(5000),
  popular: flag,
  popularLabel: formText(500),
  requiresMemberApp: flag,
  showOnFaqPage: flag,
  showCoverageTable: flag,
});

/** The FAQ editor's values, as its form holds them and its Server Actions send them. */
export type FaqForm = z.infer<typeof faqFormFields>;

/** Pure: text as saved: Windows line endings made plain, the space around it gone. */
const savedText = (text: string) => text.replace(/\r\n?/g, "\n").trim();

/** Pure: an answer's length as it's saved, which the 400-character limit counts. */
export const faqAnswerLength = (answer: string) => savedText(answer).length;

/** Every rule on the typed values, each on its own field, plus the form's message. */
function checkFaqForm(form: FaqForm, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  if (blank(form.question)) issue(["question"], "WRITE THE QUESTION");
  if (blank(form.answer)) issue(["answer"], "WRITE THE ANSWER");
  else if (faqAnswerLength(form.answer) > FAQ_ANSWER_MAX) {
    issue(["answer"], `KEEP THE ANSWER TO ${FAQ_ANSWER_MAX} CHARACTERS`);
  }
  if (blank(form.question) || blank(form.answer)) issue([], QUESTION_AND_ANSWER_TO_SAVE);

  const quoting = !blank(form.quoteReviewId) || !blank(form.quoteText);
  if (quoting && blank(form.quoteReviewId)) issue(["quoteReviewId"], "PICK THE REVIEW IT’S FROM");
  if (quoting && blank(form.quoteText)) {
    issue(["quoteText"], "PASTE OR SELECT THE WORDS TO QUOTE");
  }

  if (form.popular && blank(form.popularLabel)) issue(["popularLabel"], "WRITE THE CHIP LABEL");
  else if (form.popular && form.popularLabel.trim().length > FAQ_CHIP_LABEL_MAX) {
    issue(["popularLabel"], `KEEP THE CHIP LABEL TO ${FAQ_CHIP_LABEL_MAX} CHARACTERS`);
  }
}

/** Pure: a checked form as the FAQ's fields. A chip label counts only with Popular on. */
function toFaqInput(form: FaqForm) {
  const reviewId = form.quoteReviewId.trim();
  return {
    question: savedText(form.question),
    answer: savedText(form.answer),
    group: form.group,
    reviewQuote: reviewId ? { reviewId, text: savedText(form.quoteText) } : null,
    popularLabel: form.popular ? form.popularLabel.trim() : null,
    requiresMemberApp: form.requiresMemberApp,
    showOnFaqPage: form.showOnFaqPage,
    showCoverageTable: form.showCoverageTable,
  };
}

/** The FAQ editor's form, checked against every rule and read as the FAQ's fields. */
export const faqFormSchema = faqFormFields.superRefine(checkFaqForm).transform(toFaqInput);

/** An FAQ's fields, as the seam saves them. Its id, deep link and place are the seam's. */
export type FaqInput = z.output<typeof faqFormSchema>;

const faqId = z.string().trim().min(1).max(100);

/** "Add question": the new FAQ's form, its shape checked (the seam checks the rules). */
export const addFaqInputSchema = faqFormFields;

/** "Save question": the FAQ and its form, its shape checked (the seam checks the rules). */
export const saveFaqInputSchema = faqFormFields.extend({ id: faqId });

/** The FAQ a delete is for. */
export const faqIdInputSchema = z.object({ id: faqId });

/** ▲ or ▼: one place earlier or later in the FAQ's group. */
export const faqMoveSchema = reviewMoveSchema;

export type FaqMove = z.infer<typeof faqMoveSchema>["direction"];

/** ▲▼, as its Server Action takes it: the FAQ and the way it moves. */
export const faqMoveInputSchema = faqMoveSchema.extend({ id: faqId });

// ── Exam pages ──────────────────────────────────────────────────────────────
// Each part of an Exam page as its editor's form holds it (spec, Phase 2 →
// Exam pages & promo; BUILD-MAP §3.2): the Header's fields, the Subject names
// (their codes are fixed), the bundle offer, the SEO overrides and the
// Official Exam Date. As with Products, the Server Actions check only each
// form's shape and the seam parses it with every rule. Rules that need the
// catalogue (the Subject codes are the Exam's, the bundle Product is one of
// its Products, the share image is an upload) are the seam's. The section
// toggles are single toggles.

/** An Exam's code, as the editors send it. The seam matches it case-insensitively. */
const examCode = z.string().trim().min(1).max(20);

/** Pure: a rule's limit on a field, checked on its text as saved. */
const longerThan = (text: string, max: number) => text.trim().length > max;

/** A field that must have text: its message when blank, and its limit. */
type RequiredText = { max: number; blank: string };

/** Adds the field's message when its text is blank or longer than its limit. */
function checkRequiredText(
  ctx: z.RefinementCtx,
  path: (string | number)[],
  text: string,
  { max, blank: missing }: RequiredText,
) {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  if (blank(text)) issue(missing);
  else if (longerThan(text, max)) issue(`KEEP IT TO ${max} CHARACTERS`);
}

/** What a request that tries to change a fixed code is told: an Exam's code and board are fixed. */
export const CODES_FIXED = "THE CODES CAN’T BE CHANGED · RELOAD THE PAGE";

const examHeaderFormFields = z
  .object({
    name: formText(500),
    longName: formText(500),
    blurb: formText(5000),
    madeFor: formText(500),
  })
  // Strict, so a request carrying a code or board to change is refused.
  .strict(CODES_FIXED);

/** The Header editor's values: EXAM NAME, LONG NAME, TEXT and MADE FOR. */
export type ExamHeaderForm = z.infer<typeof examHeaderFormFields>;

const HEADER_FIELDS: Record<keyof ExamHeaderForm, RequiredText> = {
  name: { max: 60, blank: "ADD THE EXAM NAME" },
  longName: { max: 120, blank: "ADD THE LONG NAME" },
  blurb: { max: 600, blank: "ADD THE TEXT" },
  madeFor: { max: 160, blank: "ADD WHO IT’S MADE FOR" },
};

/** The Header editor's form, checked and trimmed. */
export const examHeaderFormSchema = examHeaderFormFields
  .superRefine((form, ctx) => {
    for (const field of ["name", "longName", "blurb", "madeFor"] as const) {
      checkRequiredText(ctx, [field], form[field], HEADER_FIELDS[field]);
    }
  })
  .transform((form) => ({
    name: form.name.trim(),
    longName: form.longName.trim(),
    blurb: savedText(form.blurb),
    madeFor: form.madeFor.trim(),
  }));

/** "Save header": the Exam and its Header fields, their shape checked. */
export const saveExamHeaderInputSchema = examHeaderFormFields.extend({ code: examCode });

const SUBJECT_NAME: RequiredText = { max: 120, blank: "ADD THE SUBJECT’S NAME" };

/** The most Subjects an Exam has: the Subjects covered editor's limit. */
export const MAX_SUBJECTS = 30;

const subjectNamesFormFields = z.object({
  subjects: z
    .array(z.object({ code: formText(40), name: formText(1000) }))
    .min(1)
    .max(MAX_SUBJECTS),
});

/** The Subjects covered editor's values: each Subject's fixed code and its name. */
export type SubjectNamesForm = z.infer<typeof subjectNamesFormFields>;

/** The Subjects covered editor's form, checked, with the names trimmed. */
export const subjectNamesFormSchema = subjectNamesFormFields
  .superRefine((form, ctx) => {
    form.subjects.forEach((subject, index) => {
      checkRequiredText(ctx, ["subjects", index, "name"], subject.name, SUBJECT_NAME);
    });
  })
  .transform((form) => ({
    subjects: form.subjects.map(({ code, name }) => ({ code: code.trim(), name: name.trim() })),
  }));

/** "Save subjects": the Exam and its Subject names, their shape checked. */
export const saveSubjectNamesInputSchema = subjectNamesFormFields.extend({ code: examCode });

// ── Adding and deleting Exams and Subjects (ticket 23) ──────────────────────
// Owners only (spec, Phase 2 → "Adding Exams and Subjects"). The codes and
// board are saved in capitals and fixed once saved: an Exam's code becomes
// its page's address, /exams/<code in lower case>. The rules that need the
// catalogue (a code already taken, the 12-Exam limit, what still uses an Exam
// or Subject) are the seam's, with the messages below.

export const EXAMS_LIMIT = `UP TO ${MAX_EXAMS} EXAMS. Ask the developer to raise the limit.`;
export const SUBJECTS_LIMIT = `UP TO ${MAX_SUBJECTS} SUBJECTS ON AN EXAM`;

const EXAM_CODE = "USE 2–6 LETTERS";
const BOARD = "USE 2–10 LETTERS";
const SUBJECT_CODE = "USE 1–20 LETTERS, DIGITS, SPACES OR &";

/** Pure: a typed code as saved: trimmed, in capitals, with single spaces. */
export const typedCode = (text: string) => text.trim().replace(/\s+/g, " ").toUpperCase();

/** "<CODE> IS ALREADY AN EXAM", on the code field. */
export const alreadyAnExam = (code: string) => `${code} IS ALREADY AN EXAM`;

/** "<CODE> IS ALREADY A <EXAM> SUBJECT", on the new Subject's code field. */
export const alreadyASubject = (subject: string, exam: string) =>
  `${subject} IS ALREADY A ${exam} SUBJECT`;

const newSubjectFormFields = z.object({ code: formText(40), name: formText(1000) });

/** "+ Add subject"'s values: the new Subject's code and name, as typed. */
export type NewSubjectForm = z.infer<typeof newSubjectFormFields>;

/** Adds a Subject's messages, on `path`: its code and its name. */
function checkSubject(
  ctx: z.RefinementCtx,
  path: (string | number)[],
  { code, name }: NewSubjectForm,
) {
  if (!/^[A-Z0-9 &]{1,20}$/.test(typedCode(code))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "code"], message: SUBJECT_CODE });
  }
  checkRequiredText(ctx, [...path, "name"], name, SUBJECT_NAME);
}

const savedSubject = ({ code, name }: NewSubjectForm) => ({
  code: typedCode(code),
  name: name.trim(),
});

/** "+ Add subject"'s form, checked: the code in capitals, the name trimmed. */
export const newSubjectFormSchema = newSubjectFormFields
  .superRefine((form, ctx) => checkSubject(ctx, [], form))
  .transform(savedSubject);

/** "+ Add subject": the Exam, and its new Subject's code and name, their shape checked. */
export const addSubjectInputSchema = newSubjectFormFields.extend({ exam: examCode });

const newExamFormFields = examHeaderFormFields.extend({
  code: formText(40),
  board: formText(40),
  subjects: z.array(newSubjectFormFields).max(MAX_SUBJECTS, SUBJECTS_LIMIT),
});

/** "+ Add exam"'s values: the codes, the Header's fields and the Subjects, as typed. */
export type NewExamForm = z.infer<typeof newExamFormFields>;

/** "+ Add exam"'s form, checked: the codes and board in capitals, the text trimmed. */
export const newExamFormSchema = newExamFormFields
  .superRefine((form, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (!/^[A-Z]{2,6}$/.test(typedCode(form.code))) issue(["code"], EXAM_CODE);
    if (!/^[A-Z]{2,10}$/.test(typedCode(form.board))) issue(["board"], BOARD);
    for (const field of ["name", "longName", "blurb", "madeFor"] as const) {
      checkRequiredText(ctx, [field], form[field], HEADER_FIELDS[field]);
    }
    if (form.subjects.length === 0) issue(["subjects"], "ADD AT LEAST ONE SUBJECT");
    const seen = new Set<string>();
    form.subjects.forEach((subject, index) => {
      checkSubject(ctx, ["subjects", index], subject);
      const code = typedCode(subject.code);
      if (code && seen.has(code)) issue(["subjects", index, "code"], `${code} IS LISTED TWICE`);
      seen.add(code);
    });
  })
  .transform((form) => ({
    code: typedCode(form.code),
    board: typedCode(form.board),
    name: form.name.trim(),
    longName: form.longName.trim(),
    blurb: savedText(form.blurb),
    madeFor: form.madeFor.trim(),
    subjects: form.subjects.map(savedSubject),
  }));

/** "+ Add exam"'s Save: its values, their shape checked. */
export const createExamInputSchema = newExamFormFields;

/** Pure: the Exam code a "+ Add exam" form names, as it would be saved, or "" when it names none. */
export const newExamCodeOf = (input: unknown) =>
  newExamFormSchema.safeParse(input).data?.code ?? "";

/** "Delete exam": the Exam. */
export const deleteExamInputSchema = z.object({ code: examCode });

/** A Subject's remove button: the Subject's code, matched as saved. */
export const subjectCodeInputSchema = z.object({
  code: z.string().trim().min(1).max(40).transform(typedCode),
});

/** A Subject's remove button, as its Server Action takes it: the Exam and the Subject's code. */
export const deleteSubjectInputSchema = subjectCodeInputSchema.extend({ exam: examCode });

/** Pure: "1 Product", "3 Products". */
export const productCount = (count: number) => `${count} ${count === 1 ? "Product" : "Products"}`;

/** Pure: "1 deck", "2 quizzes": a count of one kind of Member App content. */
function contentCount(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Pure: the Member App content the counts hold, by kind, such as "2 decks,
 * 1 quiz and 1 Reviewer PDF", or null when they hold none.
 */
export function contentList({ decks, quizzes, reviewerPdfs }: ContentCounts): string | null {
  return andList([
    decks > 0 ? contentCount(decks, "deck", "decks") : null,
    quizzes > 0 ? contentCount(quizzes, "quiz", "quizzes") : null,
    reviewerPdfs > 0 ? contentCount(reviewerPdfs, "Reviewer PDF", "Reviewer PDFs") : null,
  ]);
}

/** Pure: "a, b and c" from the parts given, skipping nulls; null when there are none. */
function andList(parts: readonly (string | null)[]): string | null {
  const given = parts.filter((part) => part !== null);
  const last = given.pop();
  if (last === undefined) return null;
  return given.length > 0 ? `${given.join(", ")} and ${last}` : last;
}

/**
 * Pure: why the Exam can't be deleted, or null when it can: while any Product
 * belongs to it, Live, Coming Soon or hidden, or while any of its Topics has
 * a deck, quiz or Reviewer PDF (Phase 3; Hidden and Draft ones too).
 */
export function examDeleteBlocker(
  exam: string,
  count: number,
  content: ContentCounts,
): string | null {
  if (count > 0) {
    const belong = count === 1 ? "belongs" : "belong";
    const them = count === 1 ? "it" : "them";
    return `${productCount(count)} ${belong} to ${exam}. Move or delete ${them} first.`;
  }
  const held = contentList(content);
  return held ? `${exam} has Member App content: ${held}. Delete it first.` : null;
}

/**
 * Pure: why the Subject can't be deleted, or null when it can: while a
 * Product is tagged with it, while any of its Topics has a deck, quiz or
 * Reviewer PDF (Phase 3), or while it's its Exam's only Subject. Its empty
 * Topics go with it.
 */
export function subjectDeleteBlocker({
  exam,
  subject,
  products: count,
  content,
  subjects,
}: {
  exam: string;
  subject: string;
  /** How many Products are tagged with the Subject. */
  products: number;
  /** The Member App content its Topics hold, Hidden and Draft included. */
  content: ContentCounts;
  /** How many Subjects the Exam has. */
  subjects: number;
}): string | null {
  if (count > 0) {
    const use = count === 1 ? "uses" : "use";
    const those = count === 1 ? "that Product" : "those Products";
    return `${productCount(count)} ${use} ${subject}. Remove it from ${those} first.`;
  }
  const held = contentList(content);
  if (held) return `${subject} has Member App content: ${held}. Delete it first.`;
  return subjects <= 1
    ? `${exam} needs at least one Subject. Add another before deleting this one.`
    : null;
}

/** A section toggle: Subjects covered, Bundle offer or Reviews, shown or hidden. */
export const examSectionSchema = z.object({
  section: z.enum(EXAM_PAGE_SECTIONS, { errorMap: () => ({ message: "UNKNOWN SECTION" }) }),
  on: flag,
});

/** A section toggle, as its Server Action takes it: the Exam, the section and its state. */
export const examSectionInputSchema = examSectionSchema.extend({ code: examCode });

const BUNDLE_FIELDS: Record<"headline" | "text" | "buttonLabel", RequiredText> = {
  headline: { max: 80, blank: "ADD A HEADLINE" },
  text: { max: 200, blank: "ADD THE TEXT" },
  buttonLabel: { max: 30, blank: "ADD THE BUTTON LABEL" },
};

const bundleOfferFormFields = z.object({
  productId: formText(100),
  headline: formText(1000),
  text: formText(5000),
  buttonLabel: formText(1000),
});

/** The Bundle offer editor's values. No Product ("") means no offer. */
export type BundleOfferForm = z.infer<typeof bundleOfferFormFields>;

/** The Bundle offer editor's form, checked: the offer, or null with no Product chosen. */
export const bundleOfferFormSchema = bundleOfferFormFields
  .superRefine((form, ctx) => {
    if (blank(form.productId)) return;
    for (const field of ["headline", "text", "buttonLabel"] as const) {
      checkRequiredText(ctx, [field], form[field], BUNDLE_FIELDS[field]);
    }
  })
  .transform((form) =>
    blank(form.productId)
      ? null
      : {
          productId: form.productId.trim(),
          headline: form.headline.trim(),
          text: savedText(form.text),
          buttonLabel: form.buttonLabel.trim(),
        },
  );

/** "Save bundle offer": the Exam and its offer, its shape checked. */
export const saveBundleOfferInputSchema = bundleOfferFormFields.extend({ code: examCode });

const examSeoFormFields = z.object({
  // Longer than the limits, so an over-long one is told the limit by the rules below.
  seoTitle: formText(500),
  seoDescription: formText(1000),
  /** The image it has (its src), a new upload's path, or "" for the site's. */
  shareImage: formText(300),
});

/** The Search & AI visibility editor's values. Blank uses the generated text. */
export type ExamSeoForm = z.infer<typeof examSeoFormFields>;

/** The Search & AI visibility editor's form, checked: blank fields are null. */
export const examSeoFormSchema = examSeoFormFields
  .superRefine((form, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    // Counted with the site name the layout adds, as the editor's counter counts it.
    if (!blank(form.seoTitle) && fullTitle(form.seoTitle).length > WHOLE_TITLE_MAX) {
      issue("seoTitle", `KEEP THE WHOLE TITLE TO ${WHOLE_TITLE_MAX} CHARACTERS`);
    }
    if (longerThan(form.seoDescription, SEO_DESCRIPTION_MAX)) {
      issue("seoDescription", `KEEP IT TO ${SEO_DESCRIPTION_MAX} CHARACTERS`);
    }
  })
  .transform((form) => ({
    seoTitle: textOrNull(form.seoTitle),
    seoDescription: textOrNull(savedText(form.seoDescription)),
    shareImage: textOrNull(form.shareImage),
  }));

/** "Save": the Exam and its SEO fields, their shape checked. */
export const saveExamSeoInputSchema = examSeoFormFields.extend({ code: examCode });

/** "Save" on a Site page's Search & AI visibility: the page and its SEO fields, their shape checked. */
export const saveSitePageSeoInputSchema = examSeoFormFields.extend({ site: z.enum(SITE_PAGES) });

/** A Site page's share image upload: the file and its Site page. */
export const sitePageUploadInputSchema = z.object({ site: z.enum(SITE_PAGES) });

// ── About ───────────────────────────────────────────────────────────────────
// About's six sections (ticket 21; spec, Phase 2 → Site pages), each its own
// form and its own save. Every field takes the editor's text: blank saves as
// none, which shows today's text. Each text field's limit is about 1.5×
// today's text (about-content.ts), a spec chip's 20 and a replaced photo's
// alt text 150; over is refused with the limit. The paragraphs and chips are
// fixed inputs, so there are never more than 3 or 5 of them.

/** What a replaced photo with no alt text is told. */
export const ABOUT_ALT_MISSING = "Describe the photo for screen readers.";

// Longer than any limit, so an over-long field is told its limit by the rules below.
const aboutText = formText(5000);
/** A photo as its editor holds it: "" for today's, its src, or a new upload's path; and its alt text. */
const aboutPhotoField = z.object({ src: formText(300), alt: formText(5000) });

const aboutSectionFields = z.discriminatedUnion("section", [
  z.object({ section: z.literal("header"), intro: aboutText, teamPhoto: aboutPhotoField }),
  z.object({
    section: z.literal("story"),
    heading: aboutText,
    paragraphs: z.array(aboutText).max(3, "KEEP IT TO 3 PARAGRAPHS"),
    beforeTitle: aboutText,
    beforeBody: aboutText,
    afterTitle: aboutText,
    afterSpecs: z.array(aboutText).max(5, "KEEP IT TO 5 CHIPS"),
    photos: z.array(aboutPhotoField).length(3),
  }),
  z.object({
    section: z.literal("growth"),
    firstTitle: aboutText,
    nowLead: aboutText,
    todayBody: aboutText,
    beginning: aboutText,
  }),
  z.object({
    section: z.literal("mission"),
    heading: aboutText,
    intro: aboutText,
    tabs: z.array(z.object({ title: aboutText, body: aboutText })).length(4),
  }),
  z.object({
    section: z.literal("roots"),
    heading: aboutText,
    body: aboutText,
    recipient: aboutText,
  }),
  z.object({ section: z.literal("closing"), heading: aboutText }),
]);

/** One About section's editor values: its section, and each field's text. */
export type AboutSectionForm = z.infer<typeof aboutSectionFields>;

/** "Save" on an About section: the section and its fields, their shape checked. */
export const saveAboutSectionInputSchema = aboutSectionFields;

/** Every rule on one section's typed values, each on its own field. */
function checkAboutSection(form: AboutSectionForm, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const fit = (path: (string | number)[], text: string, max: number) => {
    if (savedText(text).length > max) issue(path, `KEEP IT TO ${max} CHARACTERS`);
  };
  const photo = (path: (string | number)[], { src, alt }: { src: string; alt: string }) => {
    if (blank(src)) return;
    if (blank(alt)) issue([...path, "alt"], ABOUT_ALT_MISSING);
    else fit([...path, "alt"], alt, ABOUT_ALT_MAX);
  };
  const L = ABOUT_LIMITS;
  switch (form.section) {
    case "header":
      fit(["intro"], form.intro, L.header.intro);
      photo(["teamPhoto"], form.teamPhoto);
      return;
    case "story":
      fit(["heading"], form.heading, L.story.heading);
      form.paragraphs.forEach((text, index) => fit(["paragraphs", index], text, L.story.paragraph));
      fit(["beforeTitle"], form.beforeTitle, L.story.beforeTitle);
      fit(["beforeBody"], form.beforeBody, L.story.beforeBody);
      fit(["afterTitle"], form.afterTitle, L.story.afterTitle);
      form.afterSpecs.forEach((text, index) => fit(["afterSpecs", index], text, ABOUT_SPEC_MAX));
      form.photos.forEach((one, index) => photo(["photos", index], one));
      return;
    case "growth":
      for (const field of ["firstTitle", "nowLead", "todayBody", "beginning"] as const) {
        fit([field], form[field], L.growth[field]);
      }
      return;
    case "mission":
      fit(["heading"], form.heading, L.mission.heading);
      fit(["intro"], form.intro, L.mission.intro);
      form.tabs.forEach((tab, index) => {
        const limits = L.mission.tabs[index];
        if (!limits) return;
        fit(["tabs", index, "title"], tab.title, limits.title);
        fit(["tabs", index, "body"], tab.body, limits.body);
      });
      return;
    case "roots":
      for (const field of ["heading", "body", "recipient"] as const) {
        fit([field], form[field], L.roots[field]);
      }
      return;
    case "closing":
      fit(["heading"], form.heading, L.closing.heading);
      return;
  }
}

const savedOrNull = (text: string) => textOrNull(savedText(text));
/** A list as saved: its typed items, blanks dropped, or none when all are blank. */
const listOrNull = (items: readonly string[]) => {
  const kept = items.map(savedText).filter((item) => item !== "");
  return kept.length > 0 ? kept : null;
};
/** A photo as saved: today's (null), or its src or upload path, still to resolve, with its alt text. */
const photoOrNull = ({ src, alt }: { src: string; alt: string }) =>
  blank(src) ? null : { src: src.trim(), alt: savedText(alt) };

/** What one About section saves: its section, and its value with every blank as none. */
export type AboutSectionUpdate = {
  [Section in AboutSectionKey]: { section: Section; value: AboutContent[Section] };
}[AboutSectionKey];

function aboutSectionUpdate(form: AboutSectionForm): AboutSectionUpdate {
  switch (form.section) {
    case "header":
      return {
        section: "header",
        value: { intro: savedOrNull(form.intro), teamPhoto: photoOrNull(form.teamPhoto) },
      };
    case "story": {
      const [one, two, three] = form.photos.map(photoOrNull);
      return {
        section: "story",
        value: {
          heading: savedOrNull(form.heading),
          paragraphs: listOrNull(form.paragraphs),
          beforeTitle: savedOrNull(form.beforeTitle),
          beforeBody: savedOrNull(form.beforeBody),
          afterTitle: savedOrNull(form.afterTitle),
          afterSpecs: listOrNull(form.afterSpecs),
          photos: [one ?? null, two ?? null, three ?? null],
        },
      };
    }
    case "growth":
      return {
        section: "growth",
        value: {
          firstTitle: savedOrNull(form.firstTitle),
          nowLead: savedOrNull(form.nowLead),
          todayBody: savedOrNull(form.todayBody),
          beginning: savedOrNull(form.beginning),
        },
      };
    case "mission": {
      const tab = (index: number) => {
        const typed = form.tabs[index];
        return { title: savedOrNull(typed?.title ?? ""), body: savedOrNull(typed?.body ?? "") };
      };
      return {
        section: "mission",
        value: {
          heading: savedOrNull(form.heading),
          intro: savedOrNull(form.intro),
          tabs: [tab(0), tab(1), tab(2), tab(3)],
        },
      };
    }
    case "roots":
      return {
        section: "roots",
        value: {
          heading: savedOrNull(form.heading),
          body: savedOrNull(form.body),
          recipient: savedOrNull(form.recipient),
        },
      };
    case "closing":
      return { section: "closing", value: { heading: savedOrNull(form.heading) } };
  }
}

/** One of About's photo uploads: the file and its slot (team, story-1, story-2 or story-3). */
export const aboutPhotoUploadInputSchema = z.object({ slot: z.enum(ABOUT_PHOTO_SLOTS) });

/** One About section's form, checked: what it saves, every blank field as none. */
export const aboutSectionFormSchema = aboutSectionFields
  .superRefine(checkAboutSection)
  .transform(aboutSectionUpdate);

/** What a share image that's neither the page's nor a finished upload is told. */
export const SHARE_IMAGE_NOT_UPLOADED = "THE IMAGE ISN’T UPLOADED · ADD IT AGAIN";

const officialExamDateFormFields = z.object({
  /** YYYY-MM-DD, as a date input gives it, or "" for none. */
  officialExamDate: formText(20),
});

/** The Official Exam Date editor's value. */
export type OfficialExamDateForm = z.infer<typeof officialExamDateFormFields>;

/** The Official Exam Date editor's form, checked: a date on the calendar, or null. */
export const officialExamDateFormSchema = officialExamDateFormFields
  .superRefine((form, ctx) => {
    const date = form.officialExamDate.trim();
    if (date && !isCalendarDate(date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["officialExamDate"],
        message: "ENTER A REAL DATE",
      });
    }
  })
  .transform((form) => ({ officialExamDate: textOrNull(form.officialExamDate) }));

/** "Save date": the Exam and its Official Exam Date, its shape checked. */
export const saveOfficialExamDateInputSchema = officialExamDateFormFields.extend({
  code: examCode,
});

// ── Home promo banner and announcement bar ──────────────────────────────────
// Exam pages & promo's two strips (spec, Phase 2 → Exam pages & promo; story
// 76): the Home promo banner's text, button, link and dates, with its switch
// as a single toggle, and the announcement bar's 1–3 messages. As with Exam
// pages, the Server Actions check only each form's shape and the seam parses
// it with every rule.

export const PROMO_TEXT_MAX = 80;
export const PROMO_BUTTON_LABEL_MAX = 24;
export const ANNOUNCEMENT_TEXT_MAX = 70;
export const ANNOUNCEMENT_MESSAGES_MAX = 3;

const LINK = "ENTER AN HTTPS LINK OR A PATH STARTING WITH /";

/** Adds the link's message when it's blank or neither an https link nor a path. */
function checkStripLink(ctx: z.RefinementCtx, path: (string | number)[], link: string) {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  if (blank(link)) issue("ADD THE LINK");
  else if (!isSiteHref(link.trim())) issue(LINK);
}

const promoBannerFormFields = z.object({
  // Longer than the limits, so an over-long one is told the limit by the rules below.
  text: formText(1000),
  buttonLabel: formText(1000),
  href: formText(2000),
  /** YYYY-MM-DD, as a date input gives it. */
  startDate: formText(20),
  endDate: formText(20),
});

/** The Home promo banner editor's values. The switch saves on its own. */
export type PromoBannerForm = z.infer<typeof promoBannerFormFields>;

const PROMO_FIELDS: Record<"text" | "buttonLabel", RequiredText> = {
  text: { max: PROMO_TEXT_MAX, blank: "ADD THE BANNER TEXT" },
  buttonLabel: { max: PROMO_BUTTON_LABEL_MAX, blank: "ADD THE BUTTON LABEL" },
};

/** Adds the date's message when it's blank or not on the calendar; true when it's a real date. */
function checkDate(ctx: z.RefinementCtx, field: string, date: string, missing: string): boolean {
  const issue = (message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  if (blank(date)) issue(missing);
  else if (!isCalendarDate(date.trim())) issue("ENTER A REAL DATE");
  else return true;
  return false;
}

/** The Home promo banner editor's form, checked and trimmed. */
export const promoBannerFormSchema = promoBannerFormFields
  .superRefine((form, ctx) => {
    for (const field of ["text", "buttonLabel"] as const) {
      checkRequiredText(ctx, [field], form[field], PROMO_FIELDS[field]);
    }
    checkStripLink(ctx, ["href"], form.href);
    const starts = checkDate(ctx, "startDate", form.startDate, "ADD THE START DATE");
    const ends = checkDate(ctx, "endDate", form.endDate, "ADD THE END DATE");
    if (starts && ends && form.endDate.trim() < form.startDate.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "The end date can’t be before the start date.",
      });
    }
  })
  .transform((form) => ({
    text: form.text.trim(),
    buttonLabel: form.buttonLabel.trim(),
    href: form.href.trim(),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
  }));

/** "Save banner": its fields, their shape checked. */
export const savePromoBannerInputSchema = promoBannerFormFields;

/** "Show banner" and "Turn off banner now": a single toggle. */
export const promoBannerVisibleSchema = z.object({ visible: flag });

const announcementFormFields = z.object({
  messages: z
    .array(z.object({ text: formText(1000), href: formText(2000), requiresMemberApp: flag }))
    // Room past the limit, so a fourth message is told the rule below.
    .max(10),
});

/** The announcement bar editor's values: its messages, in the bar's order. */
export type AnnouncementForm = z.infer<typeof announcementFormFields>;

const MESSAGE_TEXT: RequiredText = { max: ANNOUNCEMENT_TEXT_MAX, blank: "ADD THE MESSAGE" };

/** The announcement bar editor's form, checked and trimmed. */
export const announcementFormSchema = announcementFormFields
  .superRefine((form, ctx) => {
    const count = form.messages.length;
    if (count < 1 || count > ANNOUNCEMENT_MESSAGES_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: `THE BAR NEEDS 1 TO ${ANNOUNCEMENT_MESSAGES_MAX} MESSAGES`,
      });
    }
    form.messages.forEach((message, index) => {
      checkRequiredText(ctx, ["messages", index, "text"], message.text, MESSAGE_TEXT);
      checkStripLink(ctx, ["messages", index, "href"], message.href);
    });
  })
  .transform((form) => ({
    messages: form.messages.map(({ text, href, requiresMemberApp }) => ({
      text: text.trim(),
      href: href.trim(),
      requiresMemberApp,
    })),
  }));

/** "Save announcement": its messages, their shape checked. */
export const saveAnnouncementInputSchema = announcementFormFields;

// ── Member App content: Topics (Phase 3, ticket 05) ─────────────────────────
// Each Subject's Topics list in the Admin (spec, Phase 3 planning decisions →
// Topics editor): any Staff User adds, renames, moves and deletes Topics. A
// name is unique within its Subject, ignoring case; that rule needs the
// Topics, so it's the seam's, with the message below.

export const TOPIC_NAME_MAX = 120;

/** A Topic's name as saved: trimmed, with single spaces, 1–120 characters. */
const topicName = z
  .string()
  .max(2000, `KEEP IT TO ${TOPIC_NAME_MAX} CHARACTERS`)
  .transform((text) => text.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "ENTER THE TOPIC’S NAME")
      .max(TOPIC_NAME_MAX, `KEEP IT TO ${TOPIC_NAME_MAX} CHARACTERS`),
  );

/** A Topic, as its row's buttons name it. */
const topicId = z.string().uuid("THAT TOPIC ISN’T THERE · RELOAD THE PAGE");

/** "+ Add topic": the Subject (its Exam's code and its own) and the new Topic's name. */
export const newTopicFormSchema = z.object({
  exam: examCode.transform(typedCode),
  subject: subjectCodeInputSchema.shape.code,
  name: topicName,
});

export type NewTopicForm = z.input<typeof newTopicFormSchema>;

/** Rename: the Topic and its new name. */
export const renameTopicFormSchema = z.object({ id: topicId, name: topicName });

export type RenameTopicForm = z.input<typeof renameTopicFormSchema>;

/** ▲▼ on a Topic: one place earlier or later in its Subject's order. */
export const topicMoveSchema = reviewMoveSchema;

export type TopicMove = z.infer<typeof topicMoveSchema>["direction"];

/** ▲▼, as its Server Action takes it: the Topic and the way it moves. */
export const topicMoveInputSchema = topicMoveSchema.extend({ id: topicId });

/** Delete: the Topic. */
export const topicIdInputSchema = z.object({ id: topicId });

/** "<SUBJECT> ALREADY HAS A TOPIC CALLED “<name>”", on the name field. */
export const alreadyATopic = (name: string, subject: string) =>
  `${subject} ALREADY HAS A TOPIC CALLED “${name}”`;

/**
 * Pure: why the Topic can't be deleted, or null when it can: while it has a
 * deck, quiz or Reviewer PDF, Hidden and Draft ones too.
 */
export function topicDeleteBlocker({ deck, quiz, reviewerPdf }: TopicContent): string | null {
  const held = andList([
    deck ? "a deck" : null,
    quiz ? "a quiz" : null,
    reviewerPdf ? "a Reviewer PDF" : null,
  ]);
  return held ? `It has ${held}. Only an empty Topic can be deleted.` : null;
}

// ── Member App content: card import (Phase 3, ticket 06) ────────────────────
// An Editor imports a Subject's cards from a CSV and a zip of images, which
// the browser has uploaded to the private content bucket (the upload seam's
// createContentUpload): the import names them by their paths. Checking the
// file gives a preview; confirming sends back what the preview was based on,
// for the conflict check.

/** An uploaded import file's path, as the upload seam gave it. Only the server reads it. */
const importFilePath = (missing: string) =>
  z
    .string({ required_error: missing, invalid_type_error: missing })
    .min(1, missing)
    .max(200, missing);

/** "Check file": the Subject, the uploaded CSV and zip (optional), and Replace or Add. */
export const cardImportInputSchema = z.object({
  exam: examCode.transform(typedCode),
  subject: subjectCodeInputSchema.shape.code,
  csv: importFilePath("CHOOSE THE CSV FILE"),
  zip: importFilePath("CHOOSE THE ZIP OF IMAGES AGAIN").nullable(),
  mode: z.enum(IMPORT_MODES, { errorMap: () => ({ message: "CHOOSE REPLACE OR ADD" }) }),
});

export type CardImportInput = z.input<typeof cardImportInputSchema>;

/** "Import": the same, with what the preview was based on. */
export const confirmCardImportInputSchema = cardImportInputSchema.extend({
  basedOn: z
    .string({ required_error: "CHECK THE FILE AGAIN", invalid_type_error: "CHECK THE FILE AGAIN" })
    .regex(/^[0-9a-f]{64}$/, "CHECK THE FILE AGAIN"),
});

export type ConfirmCardImportInput = z.input<typeof confirmCardImportInputSchema>;

// ── Member App content: the card editor (Phase 3, ticket 07) ────────────────
// A Topic's deck, one card at a time (spec, Phase 3 → Content model; stories
// 125, 127, 128): any Staff User adds, edits, moves and deletes cards, and
// makes the deck Visible or Hidden and Free Preview. A card's text follows
// src/lib/cards/card-fields.ts, which the browser checks first; its image is
// the card's own, a finished "card-image" upload's path, or none.

const cardId = z.string().uuid("THAT CARD ISN’T THERE · RELOAD THE PAGE");
const deckId = z.string().uuid("THAT DECK ISN’T THERE · RELOAD THE PAGE");

/** A card field from the form: text, held to a generous size before its own rules run. */
const cardFieldText = z
  .string({ invalid_type_error: "ENTER TEXT", required_error: "ENTER TEXT" })
  .max(20_000, "THAT’S FAR TOO LONG FOR A CARD");

/** The card form's fields: the front, back and note, and the back image. */
const cardFieldShape = {
  front: cardFieldText,
  back: cardFieldText,
  // A blank note is saved as none (null), and a saved card's form sends that back.
  note: cardFieldText.nullish().transform((note) => note ?? ""),
  image: z
    .string({ invalid_type_error: "UPLOAD THE IMAGE AGAIN" })
    .min(1, "UPLOAD THE IMAGE AGAIN")
    .max(300, "UPLOAD THE IMAGE AGAIN")
    .nullable()
    .default(null),
};

/** Adds card-fields.ts's message to each field that can't be saved. */
function checkCardFields(
  card: { front: string; back: string; note: string },
  ctx: z.RefinementCtx,
) {
  for (const [field, message] of Object.entries(cardFieldProblems(card))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  }
}

/**
 * "Save" or "Save & add next" on a new card: its Topic and its fields, as
 * saved (trimmed, a blank note as none). The deck is made when it has none.
 */
export const newCardFormSchema = z
  .object({ topic: topicId, ...cardFieldShape })
  .superRefine(checkCardFields)
  .transform(({ topic, image, ...text }) => ({ topic, ...cardFieldsOf(text), image }));

export type NewCardForm = z.input<typeof newCardFormSchema>;

/** "Save" on a card being edited: which card, and its fields, as saved. */
export const cardFormSchema = z
  .object({ id: cardId, ...cardFieldShape })
  .superRefine(checkCardFields)
  .transform(({ id, image, ...text }) => ({ id, ...cardFieldsOf(text), image }));

export type CardForm = z.input<typeof cardFormSchema>;

/** ▲▼ on a card: one place earlier or later in its deck. */
export const cardMoveInputSchema = reviewMoveSchema.extend({ id: cardId });

/** Delete: the card. */
export const cardIdInputSchema = z.object({ id: cardId });

/** "Visible to members": the deck, and whether Members see it. */
export const deckVisibilityInputSchema = z.object({
  deck: deckId,
  visible: z.boolean({ invalid_type_error: "SHOULD BE ON OR OFF" }),
});

/** "Free Preview": the deck, and whether Members with no Access Pass can open it. */
export const deckFreePreviewInputSchema = z.object({
  deck: deckId,
  freePreview: z.boolean({ invalid_type_error: "SHOULD BE ON OR OFF" }),
});
