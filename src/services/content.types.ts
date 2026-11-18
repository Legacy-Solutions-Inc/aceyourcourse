// The Member App's content model (spec, Phase 3 → Content model; CONTEXT.md):
// Exam → Subject → Topic, and each Topic's deck, quiz and Reviewer PDF, each
// optional. Both the Member seam and the Admin seam read these records; the
// Admin edits them. Questions and page images come with later tickets.
// The Access Pass records are here too: they decide what a Member may open.

/** The three kinds of study content a Topic can have, in the order the Library shows them. */
export const CONTENT_KINDS = ["deck", "quiz", "reviewer-pdf"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

/** Decks and quizzes are Hidden until Staff make them Visible. */
export const CONTENT_VISIBILITIES = ["hidden", "visible"] as const;
export type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number];

/** A Reviewer PDF goes Processing → Draft → Published or Unpublished, or Processing → Failed. */
export const REVIEWER_PDF_STATUSES = [
  "processing",
  "draft",
  "published",
  "unpublished",
  "failed",
] as const;
export type ReviewerPdfStatus = (typeof REVIEWER_PDF_STATUSES)[number];

/** A unit of study within a Subject, in its Subject's order. */
export interface Topic {
  id: string;
  /** The Exam and Subject it belongs to: the Subject's code is unique within its Exam. */
  examCode: string;
  subjectCode: string;
  /** Unique within its Subject, ignoring case. */
  name: string;
  /** Its place in its Subject's order, from 1. */
  position: number;
}

/** A Topic's flashcard deck: at most one per Topic. */
export interface Deck {
  id: string;
  topicId: string;
  visibility: ContentVisibility;
  freePreview: boolean;
}

/**
 * A flashcard in a deck (ticket 06): front text, a back and an optional note,
 * each in the formula notation, and an optional back image.
 */
export interface Card {
  id: string;
  deckId: string;
  /** Its place in its deck's order, from 1. */
  position: number;
  front: string;
  back: string;
  note: string | null;
  /** Where its back image is in the private content bucket, or null. */
  image: string | null;
}

/** A Member's verdict on a card: Got it, or Review again. */
export const CARD_MARK_VERDICTS = ["got", "again"] as const;
export type CardMarkVerdict = (typeof CARD_MARK_VERDICTS)[number];

/**
 * A Card Mark (CONTEXT.md; spec, Phase 3 → Progress storage): a Member's
 * latest verdict on one card, kept as current state, at most one per Member
 * and card. Deleting the card deletes every Member's mark on it (ticket 07);
 * the flashcard player writes them (ticket 08).
 */
export interface CardMark {
  /** The Member's User id. */
  userId: string;
  cardId: string;
  verdict: CardMarkVerdict;
  /** ISO time of the latest mark. */
  markedAt: string;
}

/**
 * A Study Day (CONTEXT.md; spec, Phase 3 → Progress storage): a Manila
 * calendar day on which a Member studied, at most one per Member and day.
 * Marking a card records the day it was marked (ticket 08); the Study Streak
 * is counted from these (ticket 15).
 */
export interface StudyDay {
  /** The Member's User id. */
  userId: string;
  /** The Asia/Manila date, YYYY-MM-DD. */
  day: string;
}

/**
 * Where a Member left a deck (spec, Phase 3 → Resume): the card they were on,
 * at most one per Member and deck. Finishing the deck clears it, so the deck
 * opens at its first card again; deleting the card clears it too.
 */
export interface DeckPosition {
  /** The Member's User id. */
  userId: string;
  deckId: string;
  /** The card to continue from. */
  cardId: string;
  /** ISO time it was saved. */
  savedAt: string;
}

/** A Topic's quiz: at most one per Topic. Its questions come with ticket 09. */
export interface Quiz {
  id: string;
  topicId: string;
  visibility: ContentVisibility;
  freePreview: boolean;
}

/**
 * A Reviewer PDF: at most one per Topic. Until Staff place it under a Topic
 * it has none, and it can't be Published. Its file and page images come with
 * ticket 12.
 */
export interface ReviewerPdf {
  id: string;
  topicId: string | null;
  status: ReviewerPdfStatus;
  freePreview: boolean;
}

/** Every Topic and its content, as both seams' rules read them. */
export interface ContentRecords {
  topics: Topic[];
  decks: Deck[];
  quizzes: Quiz[];
  reviewerPdfs: ReviewerPdf[];
}

/** What a Topic holds: each kind's visibility or status, or null when it has none. */
export interface TopicContent {
  deck: ContentVisibility | null;
  quiz: ContentVisibility | null;
  reviewerPdf: ReviewerPdfStatus | null;
}

/** How much of each kind of content something holds, for the delete rules. */
export interface ContentCounts {
  decks: number;
  quizzes: number;
  reviewerPdfs: number;
}

/**
 * A Member's Access Pass (CONTEXT.md; ADR 0010): their right to all of one
 * Exam's study content until `endsAt`. At most one per Member and Exam.
 */
export interface AccessPass {
  /** The Member's User id. */
  userId: string;
  examCode: string;
  /** ISO time it ends: active while that is later than now. */
  endsAt: string;
}

/**
 * One grant that made or extended an Access Pass, kept as its history.
 * Granting comes with ticket 17; until then the history is empty.
 */
export interface AccessPassGrant {
  userId: string;
  examCode: string;
  /** How many days it added. */
  days: number;
  /** ISO times the days it added start and end. */
  startsAt: string;
  endsAt: string;
  reason: string;
  /** The Staff User who granted it, as they were then. */
  grantedBy: { email: string; name: string };
  grantedAt: string;
}
