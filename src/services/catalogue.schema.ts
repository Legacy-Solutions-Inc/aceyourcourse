import { z } from "zod";

import type { Exam, WebsiteSettings } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Validation for the Catalogue seed (docs/mockup/aycData.js ported to a typed
// seed today, the client's catalogue spreadsheet later). The mock validates its
// seed when it loads, so a bad edit fails loudly instead of rendering a broken
// Website. Ticket 02 extends this with Products and Reviews.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything the seed holds. The Member App switch is not seed data: it comes
 * from the MEMBER_APP_LIVE environment variable, so it flips with no code change.
 */
export interface CatalogueSeed {
  exams: Exam[];
  settings: Omit<WebsiteSettings, "memberAppLive">;
}

const nonBlank = (label: string) => z.string().trim().min(1, `${label} must not be blank`);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "must be a real date");

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
  const seen = new Set<string>();
  exams.forEach((exam, index) => {
    // Codes are looked up case-insensitively, so "CE" and "Ce" collide.
    const key = exam.code.toUpperCase();
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "code"],
        message: `duplicate Exam code "${exam.code}"`,
      });
    }
    seen.add(key);
  });
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
  .refine((banner) => banner.endDate >= banner.startDate, {
    path: ["endDate"],
    message: "must not be before startDate",
  });

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

export const catalogueSeedSchema: z.ZodType<CatalogueSeed> = z.object({
  exams: examsSchema,
  settings: settingsSchema,
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
