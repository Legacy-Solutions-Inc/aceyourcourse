import { z } from "zod";

import { isMarketplaceUrl, isOnHost } from "@/lib/catalogue/store-links";
import type { AdminError, RequiredRole, StaffActor } from "@/services/admin.types";
import { httpsUrl } from "@/services/catalogue.schema";
import type { Marketplace } from "@/services/catalogue.types";

// The Admin seam's zod input schemas (CONVENTIONS §3), shared by the seam's
// arms, the Staff Guard and the forms.

/** A sign-in email: trimmed and lowercased, because the staff list compares emails case-insensitively. */
export const staffEmailSchema = z.string().trim().toLowerCase().email();

const MISSING_EMAIL = "Enter an email address.";

/** The "Sign in as" form's "Other email" (sample mode). */
export const signInAsSchema = z.object({
  email: z
    .string({ required_error: MISSING_EMAIL, invalid_type_error: MISSING_EMAIL })
    .trim()
    .min(1, MISSING_EMAIL)
    .email("Enter a valid email address, like name@example.com."),
});

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

/** Each Marketplace's shop page and the social profiles. An empty one is hidden. */
export const linkSettingsSchema = z.object({
  shopLinks: z.object({
    shopee: shopLink("shopee", "SHOULD BE A SHOPEE.PH LINK"),
    lazada: shopLink("lazada", "SHOULD BE A LAZADA.COM.PH LINK"),
    tiktok: shopLink("tiktok", "SHOULD BE A TIKTOK LINK"),
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
