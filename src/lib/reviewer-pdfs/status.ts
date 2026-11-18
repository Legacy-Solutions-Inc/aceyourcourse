import type { ReviewerPdfStatus, ReviewerPdfUpload } from "@/services/content.types";

// ─────────────────────────────────────────────────────────────────────────────
// A Reviewer PDF's status rules (Phase 3, ticket 13; story 116; spec, Phase 3
// → Content model; BUILD-MAP §3.5), pure, shared by both arms of the Admin
// seam and the Reviewer PDF screen, which disables a button with the reason
// these give:
//   Processing → Draft → Published ⇄ Unpublished, or Processing → Failed.
// Placing (or moving) needs a job that succeeded, as a Draft's or an
// Unpublished one's did: a Processing upload waits until it's split, so a
// Failed one never holds the Topic that its new upload needs (one Reviewer
// PDF per Topic), and a Published one is unpublished before it moves, so
// live content never changes Exam or Topic unseen. Publishing needs a Topic
// and every page; unpublishing leaves it Unpublished (never Draft). Asking
// for the status it has already is no change, and never refused. Only a
// Published one is in the Member App (src/services/content.rules.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** What an Editor does to a Reviewer PDF's status or place. */
export type ReviewerPdfChange = "place" | "publish" | "unpublish";

/** What the rules read of a Reviewer PDF. */
export interface ReviewerPdfState {
  status: ReviewerPdfStatus;
  /** Whether it's placed under a Topic. */
  hasTopic: boolean;
  /** Whether its job split its PDF into every page (hasEveryPage). */
  hasPages: boolean;
}

export const CHOOSE_A_TOPIC = "CHOOSE A TOPIC BEFORE PUBLISHING";
export const STILL_SPLITTING = "WAIT UNTIL IT’S SPLIT INTO PAGES";
export const SPLIT_FAILED = "IT COULDN’T BE SPLIT INTO PAGES · DELETE IT AND UPLOAD THE PDF AGAIN";
/** The sample data's Reviewer PDFs, from before uploads, have no file and no pages. */
export const NO_PAGES = "IT HAS NO PAGES · UPLOAD ITS PDF FIRST";
export const NOT_PUBLISHED = "IT ISN’T PUBLISHED";
export const UNPUBLISH_TO_MOVE = "IT’S PUBLISHED · UNPUBLISH IT BEFORE MOVING IT";
/** One Reviewer PDF per Topic: the screen links the one already there. */
export const TOPIC_TAKEN = "THIS TOPIC ALREADY HAS A REVIEWER PDF · CHOOSE ANOTHER";
export const TOPIC_GONE = "THAT TOPIC ISN’T THERE ANY MORE · CHOOSE ANOTHER";

/** Pure: whether a Reviewer PDF's job has split every page of its PDF. */
export function hasEveryPage(upload: ReviewerPdfUpload | null): boolean {
  return upload !== null && upload.pageCount !== null && upload.pagesDone === upload.pageCount;
}

/** Pure: what the rules read of a Reviewer PDF, from its record and its upload. */
export const reviewerPdfState = (
  pdf: { status: ReviewerPdfStatus; topicId: string | null },
  upload: ReviewerPdfUpload | null,
): ReviewerPdfState => ({
  status: pdf.status,
  hasTopic: pdf.topicId !== null,
  hasPages: hasEveryPage(upload),
});

/** Pure: why this change can't be made to a Reviewer PDF in this state, or null when it can. */
export function changeRefusal(
  { status, hasTopic, hasPages }: ReviewerPdfState,
  change: ReviewerPdfChange,
): string | null {
  if (change === "unpublish") {
    return status === "published" || status === "unpublished" ? null : NOT_PUBLISHED;
  }
  if (change === "publish" && status === "published") return null;
  if (status === "processing") return STILL_SPLITTING;
  if (status === "failed") return SPLIT_FAILED;
  if (change === "place") return status === "published" ? UNPUBLISH_TO_MOVE : null;
  if (!hasPages) return NO_PAGES;
  return hasTopic ? null : CHOOSE_A_TOPIC;
}

/** Pure: the status a publish or an unpublish leaves. */
export const statusAfterChange = (change: "publish" | "unpublish"): ReviewerPdfStatus =>
  change === "publish" ? "published" : "unpublished";
