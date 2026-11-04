import { z } from "zod";

import { parsePeso } from "@/lib/admin/peso";
import { fullTitle, WHOLE_TITLE_MAX } from "@/lib/admin/seo-check";
import { isMarketplaceUrl, isOnHost } from "@/lib/catalogue/store-links";
import { isCalendarDate } from "@/lib/manila-time";
import { variationLabel } from "@/lib/catalogue/price";
import type { AdminError, RequiredRole, StaffActor } from "@/services/admin.types";
import {
  EXAM_PAGE_SECTIONS,
  FAQ_ANSWER_MAX,
  FAQ_GROUPS,
  httpsUrl,
  isSiteHref,
  PRODUCT_FORMATS,
} from "@/services/catalogue.schema";
import type { Marketplace, Review } from "@/services/catalogue.types";

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

const examHeaderFormFields = z.object({
  name: formText(500),
  longName: formText(500),
  blurb: formText(5000),
  madeFor: formText(500),
});

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

const subjectNamesFormFields = z.object({
  subjects: z
    .array(z.object({ code: formText(40), name: formText(1000) }))
    .min(1)
    .max(30),
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
