import { z } from "zod";

import { TOKEN_HASH_PATTERN } from "@/lib/member-app/device-token";
import { staffEmailSchema } from "@/services/admin.schema";
import type { TargetExamRefusal } from "@/services/member.types";

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

/** A device token's hash, as the Active Device record holds it: SHA-256 in 64 lowercase hex characters. */
export const tokenHashSchema = z.string().regex(TOKEN_HASH_PATTERN, "must be a SHA-256 hash");

/** A device label, such as "Chrome on Android". */
export const deviceLabelSchema = z.string().trim().min(1).max(80);

/** A claim of the Active Device: the token's hash, never the token, and the label. */
export const deviceClaimSchema = z.object({
  tokenHash: tokenHashSchema,
  deviceLabel: deviceLabelSchema,
});

/** What the Member App says for each refused Target Exam change. */
export const TARGET_EXAM_REFUSALS: Record<TargetExamRefusal, string> = {
  "not-an-exam": "Pick one of the exams listed.",
  "already-yours": "Already one of your exams",
  "date-required": "Enter your exam date.",
  "invalid-date": "Enter a real date.",
  "date-in-past": "That date has passed. Enter today’s date or a later one.",
  "not-yours": "That exam isn’t one of yours.",
  "last-one": "You can’t remove your only exam. Add another one first.",
};

/** A form field as text: a missing field or a file reads as blank, which the seam then refuses. */
const formText = z.string().trim().max(40).catch("");

/** What the Target Exam forms send: the Exam picked and, where there is one, the date typed. */
export const targetExamFormSchema = z.object({ examCode: formText, examDate: formText });
