import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { ReviewerPdfFailure } from "@/lib/reviewer-pdfs/job";

// The Member App's content model (spec, Phase 3 → Content model; CONTEXT.md):
// Exam → Subject → Topic, and each Topic's deck, quiz and Reviewer PDF, each
// optional. Both the Member seam and the Admin seam read these records; the
// Admin edits them. Page images come with later tickets.
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

/**
 * A Topic's quiz: at most one per Topic, with its settings (ticket 09): the
 * passing score (a whole percentage, 1–100), whether its questions are
 * shuffled, and whether Members see the answers after scoring.
 */
export interface Quiz {
  id: string;
  topicId: string;
  visibility: ContentVisibility;
  freePreview: boolean;
  passingScore: number;
  shuffle: boolean;
  showAnswers: boolean;
}

/**
 * A question in a quiz (ticket 09): the question, four choices A–D, the
 * correct choice and an explanation, each in the formula notation, and an
 * optional figure. A question taken out of its quiz is kept, marked removed
 * (`removedAt`, with no place), for Members' old attempts to show.
 */
export interface Question {
  id: string;
  quizId: string;
  /** Its place in its quiz's order, from 1, or null once it's removed. */
  position: number | null;
  question: string;
  choices: Record<QuizChoice, string>;
  correct: QuizChoice;
  explanation: string;
  /** Where its figure is in the private content bucket, or null. */
  figure: string | null;
  /** ISO time it was taken out of its quiz, or null while it's in it. */
  removedAt: string | null;
}

/**
 * One answer in a Quiz Attempt (ticket 11): the question, the choice the
 * Member picked (null when they left it unanswered, which is wrong), and
 * whether it was right when they submitted. The verdict is kept as it was,
 * so a later correction to the question never changes the attempt's score.
 */
export interface QuizAttemptAnswer {
  questionId: string;
  choice: QuizChoice | null;
  isCorrect: boolean;
}

/**
 * A Quiz Attempt (CONTEXT.md; spec, Phase 3 → Progress storage, Quizzes are
 * graded on the server): one submitted pass through a quiz, graded on the
 * server, kept for good. Its score is a whole percentage, rounded down, and
 * the Member's Best Score on a quiz is the highest score of their attempts.
 * Its id is the attempt's own, sent with the submit, so the same attempt
 * posted twice is saved once.
 */
export interface QuizAttempt {
  id: string;
  /** The Member's User id. */
  userId: string;
  quizId: string;
  /** ISO time it was submitted. */
  submittedAt: string;
  /** How many answers were right, out of `questionCount`: the questions in the quiz then. */
  correctCount: number;
  questionCount: number;
  /** correctCount as a whole percentage of questionCount, rounded down. */
  score: number;
  /** The quiz's passing score when it was submitted, which it passed at or above. */
  passingScore: number;
  /** In the order the Member saw them. */
  answers: QuizAttemptAnswer[];
}

/** A Quiz Attempt without its answers: what the attempts list and the Best Score read. */
export type QuizAttemptScore = Omit<QuizAttempt, "answers">;

/**
 * A Reviewer PDF: at most one per Topic. Until Staff place it under a Topic
 * it has none, and it can't be Published. Its file and the job splitting it
 * into page images are its ReviewerPdfUpload (ticket 12).
 */
export interface ReviewerPdf {
  id: string;
  topicId: string | null;
  status: ReviewerPdfStatus;
  freePreview: boolean;
}

/**
 * A Reviewer PDF's uploaded file, and the job splitting it into page images
 * (ticket 12; ADR 0012): the PDF's page count once read, the pages done, the
 * heartbeat each run beats after every page, how often the cron has
 * restarted it, and why it failed. The sample data's Reviewer PDFs, from
 * before uploads, have none.
 */
export interface ReviewerPdfUpload {
  fileName: string;
  /** In bytes, as Storage holds it. */
  fileSize: number;
  /** ISO time it was uploaded. */
  uploadedAt: string;
  pageCount: number | null;
  pagesDone: number;
  /** ISO time of the job's last heartbeat. */
  heartbeatAt: string | null;
  restarts: number;
  failure: ReviewerPdfFailure | null;
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
