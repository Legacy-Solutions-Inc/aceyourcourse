import { z } from "zod";

import { TOKEN_HASH_PATTERN } from "@/lib/member-app/device-token";
import {
  DELETION_CONFIRMATION,
  isDeletionConfirmed,
  PRIVACY_REQUEST_TYPES,
} from "@/lib/member-app/privacy-requests";
import { ORDER_REFERENCE_PATTERN } from "@/lib/payments/order-ledger";
import { QUIZ_CHOICES } from "@/lib/quizzes/quiz-rules";
import { isReaderZoom } from "@/lib/reviewer-pdfs/reader";
import { staffEmailSchema } from "@/services/admin.schema";
import { CARD_MARK_VERDICTS, CONTENT_KINDS } from "@/services/content.types";
import type { PayRefusal, TargetExamRefusal } from "@/services/member.types";

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

/** What the Plans page says when Pay is refused (Phase 4, ticket 03). Nothing is charged. */
export const PAY_REFUSALS: Record<PayRefusal, string> = {
  unavailable: "Buying isn’t open yet. You weren’t charged.",
  "bad-method": "Pick QR Ph, GCash, Maya or Card to pay with.",
  "not-on-sale": "That plan isn’t on sale any more. Pick another one.",
  "wrong-exam": "That plan isn’t for this exam. Pick one of the plans shown.",
};

/** What the Plans page's Pay sends: the Exam open on the page, the Plan picked and the method. */
export const payFormSchema = z.object({ examCode: formText, plan: formText, method: formText });

/** What sample mode's "Simulate paid" / "Simulate failed" sends: the Order and the outcome. */
export const simulateFormSchema = z.object({
  reference: z.string().regex(ORDER_REFERENCE_PATTERN),
  outcome: z.enum(["paid", "failed"]),
});

/**
 * A deck, quiz or Reviewer PDF, as the address names it when a Member opens
 * one (Phase 3, ticket 05). The address is the browser's, so anything else
 * reads as nothing there.
 */
export const contentRefSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  id: z.string().uuid(),
});

/** Whether an id the browser sent is a record's id (a UUID): anything else names nothing. */
export const isRecordId = (value: string): boolean => z.string().uuid().safeParse(value).success;

/** An id as the browser sends it, unchecked: the seam finds nothing for one that isn't a record's. */
const sentId = z.string().max(100);

/** "Got it" or "Review again" on a card (ticket 08). Any other verdict is refused outright. */
export const cardMarkInputSchema = z.object({
  cardId: sentId,
  verdict: z.enum(CARD_MARK_VERDICTS),
});

/** Where a Member is in a deck: the card they're on, or null once they finish it (ticket 08). */
export const deckPositionInputSchema = z.object({
  deckId: sentId,
  cardId: sentId.nullable(),
});

/**
 * What the flashcard player sends with a mark (ticket 08): the deck it's
 * studying, the card and verdict, and where the Member is in the deck once
 * it's marked (null while reviewing, which leaves the position alone).
 */
export const studyMarkSchema = z.object({
  deckId: z.string().uuid(),
  cardId: sentId,
  verdict: z.enum(CARD_MARK_VERDICTS),
  position: z.object({ cardId: sentId.nullable() }).nullable(),
});

/** What the flashcard player sends when the Member moves without marking, starts again or finishes. */
export const studyPositionSchema = z.object({
  deckId: z.string().uuid(),
  cardId: sentId.nullable(),
});

export type StudyMarkInput = z.input<typeof studyMarkSchema>;
export type StudyPositionInput = z.input<typeof studyPositionSchema>;

/** The most answers a submit may carry: far more than any quiz has questions. */
export const MAX_QUIZ_ANSWERS = 1000;

/**
 * What the quiz screen sends on Submit (ticket 11): the attempt's own id,
 * made when it started, so the same attempt posted twice is saved once; the
 * quiz; and the Member's choice on each question, in the order they saw them
 * (null for one left unanswered). The seam marks it against the quiz as it
 * is: a question it doesn't name counts as wrong, and one that isn't the
 * quiz's refuses the submit.
 */
export const quizSubmitSchema = z.object({
  attemptId: z.string().uuid(),
  quizId: sentId,
  answers: z
    .array(z.object({ questionId: sentId, choice: z.enum(QUIZ_CHOICES).nullable() }))
    .max(MAX_QUIZ_ANSWERS),
});

/** One of the Member's past attempts at a quiz, as its address names it (ticket 11). */
export const attemptRefSchema = z.object({ quizId: sentId, attemptId: sentId });

/**
 * One page of a Reviewer PDF, as the page endpoint asks for it (ticket 14),
 * from its address: a Reviewer PDF or page that isn't one is no page.
 */
export const reviewerPageInputSchema = z.object({
  reviewerPdfId: sentId,
  // Any number: one that isn't a page is refused after the access decision.
  page: z.number(),
});

/** Where the Member is in a Reviewer PDF, as the reader saves it: the page and one of the reader's zooms. */
export const readerPositionInputSchema = z.object({
  reviewerPdfId: sentId,
  page: z.number().int(),
  zoom: z.number().refine(isReaderZoom, "must be one of the reader's zooms"),
});

/** A notice's id, as the Member App's "Dismiss" sends it. Anything else is no notice. */
export const noticeIdSchema = z.string().uuid();

/** A Privacy Request's type, as Account's buttons ask for it. */
export const privacyRequestTypeSchema = z.enum(PRIVACY_REQUEST_TYPES);

/** What "Delete my account" says when the confirmation isn't typed. */
export const DELETION_NOT_CONFIRMED = `Type ${DELETION_CONFIRMATION}, in capitals, to confirm.`;

/** "Delete my account"'s form: the confirmation the Member typed. */
export const deletionRequestFormSchema = z.object({
  confirmation: z
    .string()
    .catch("")
    .refine(isDeletionConfirmed, { message: DELETION_NOT_CONFIRMED }),
});
