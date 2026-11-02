import { z } from "zod";

import { parsePeso } from "@/lib/admin/peso";
import { isMarketplaceUrl, isOnHost } from "@/lib/catalogue/store-links";
import { variationLabel } from "@/lib/catalogue/price";
import type { AdminError, RequiredRole, StaffActor } from "@/services/admin.types";
import { httpsUrl, PRODUCT_FORMATS } from "@/services/catalogue.schema";
import type { Marketplace } from "@/services/catalogue.types";

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
