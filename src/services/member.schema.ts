import { z } from "zod";

import { staffEmailSchema } from "@/services/admin.schema";

// The Member seam's zod schemas, shared by its arms.

/** An email as the Beta Tester list and the Members hold it: trimmed and lowercased. */
export const memberEmailSchema = staffEmailSchema;

/** The signed-in User a Member record is made for. The seam's callers pass what sign-in verified. */
export const memberUserSchema = z.object({
  userId: z.string().uuid(),
  email: memberEmailSchema,
  name: z
    .string()
    .nullable()
    .transform((name) => name?.trim() || null),
});

/** A Member's User id, as the Member App gate passes it. */
export const memberUserIdSchema = z.string().uuid();

/** A legal document's version, as the legal documents number them: "2.0". */
export const legalVersionSchema = z.string().regex(/^\d+\.\d+$/, "must be a version like 2.0");

/** The versions in one agreement to the Terms of Use and the Privacy Policy. */
export const agreedVersionsSchema = z.object({
  termsVersion: legalVersionSchema,
  privacyVersion: legalVersionSchema,
});

/** What the consent screen says when the action is sent without both agreements. */
export const BOTH_AGREEMENTS_REQUIRED = "Tick both boxes to agree to the Terms and Privacy Policy.";

/**
 * The versions the consent screen showed, sent back with its form. A missing
 * or odd version reads as blank, which is never current, so the screen
 * reloads with the current versions.
 */
export const shownVersionsSchema = z.object({
  termsVersion: z.string().catch(""),
  privacyVersion: z.string().catch(""),
});

/** The consent screen's two boxes, both ticked. */
export const bothAgreementsSchema = z.object({
  terms: z.literal("agreed", { errorMap: () => ({ message: BOTH_AGREEMENTS_REQUIRED }) }),
  privacy: z.literal("agreed", { errorMap: () => ({ message: BOTH_AGREEMENTS_REQUIRED }) }),
});
