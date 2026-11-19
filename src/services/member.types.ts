import type { z } from "zod";

import type { AllowedVia, RefusedDecision } from "@/lib/member-app/access";
import type { ExamDateSetBy } from "@/lib/member-app/exam-date";
import type { AttemptReview } from "@/lib/quizzes/grading";
import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { ReaderPlace } from "@/lib/reviewer-pdfs/reader";
import type { CardMarkVerdict, ContentKind } from "@/services/content.types";
import type {
  attemptRefSchema,
  cardMarkInputSchema,
  deckPositionInputSchema,
  quizSubmitSchema,
  readerPositionInputSchema,
  reviewerPageInputSchema,
} from "@/services/member.schema";

// The Member seam's types (spec, Phase 3 → Phase 3 seams). A Member is a
// person with a Member App account (CONTEXT.md), keyed by their User.

/** The signed-in User, as sign-in verified them: the Member seam's caller. */
export interface MemberUser {
  /** The Supabase User's id. */
  userId: string;
  /** Their verified email. */
  email: string;
  /** Their Google profile name, when sign-in gave one. */
  name: string | null;
}

/** A Member's record, made the first time they pass the Member App gate. */
export interface Member {
  /** The Supabase User's id: a Member is keyed by their User. */
  userId: string;
  /** Their email when they joined, lowercased. */
  email: string;
  /** Their Google profile name when they joined, or null when sign-in gave none. */
  name: string | null;
  /** ISO time they first passed the gate. */
  joinedAt: string;
}

/** The Terms of Use and Privacy Policy versions in one agreement, such as "2.0". */
export interface AgreedVersions {
  termsVersion: string;
  privacyVersion: string;
}

/**
 * One time a Member agreed to the Terms of Use and the Privacy Policy, with
 * the versions they agreed to (spec, Phase 3 → Consent). Agreements are kept
 * as history: a new one is added each time, and none is ever changed.
 */
export interface ConsentRecord extends AgreedVersions {
  /** The Member's User id. */
  userId: string;
  /** ISO time they agreed. */
  agreedAt: string;
}

/** An Exam a Member can pick as a Target Exam: one that's on the Website. */
export interface PickableExam {
  /** Uppercase code, such as "CE". */
  code: string;
  /** Board acronym, such as "CELE". */
  board: string;
  name: string;
  /** The Exam's Official Exam Date (YYYY-MM-DD), which a new Target Exam follows. Null when Staff set none. */
  officialExamDate: string | null;
}

/**
 * One of a Member's Target Exams (CONTEXT.md): an Exam plus the Member's Exam
 * Date for it (spec, Phase 3 → Target Exams).
 */
export interface TargetExam {
  examCode: string;
  board: string;
  name: string;
  /**
   * The Exam Date (YYYY-MM-DD): the Member's own once they have set one, and
   * the Exam's Official Exam Date until then. Null when neither is set.
   */
  examDate: string | null;
  /** Whose date `examDate` is. Null when there is none. */
  dateSetBy: ExamDateSetBy | null;
  /** Whether this is the Member's selected Target Exam: exactly one is. */
  selected: boolean;
  /** ISO time the Member first added it. */
  addedAt: string;
}

/** What the onboarding and add forms send. */
export interface NewTargetExam {
  examCode: string;
  /** YYYY-MM-DD, or blank or null to follow the Exam's Official Exam Date. */
  examDate: string | null;
}

/** A Target Exam just added, or restored when the Member had removed it earlier. */
export interface AddedTargetExam {
  targetExam: TargetExam;
  /** It was removed earlier, and came back with its own date. */
  restored: boolean;
}

/** Why a Target Exam change was refused. */
export type TargetExamRefusal =
  /** No such Exam, or one that isn't on the Website. */
  | "not-an-exam"
  /** Already one of the Member's Target Exams. */
  | "already-yours"
  /** The Exam has no Official Exam Date, so the Member must give a date. */
  | "date-required"
  /** Not a date on the calendar. */
  | "invalid-date"
  /** Before today in Asia/Manila. */
  | "date-in-past"
  /** Not one of this Member's Target Exams. */
  | "not-yours"
  /** The Member's last Target Exam can't be removed. */
  | "last-one";

export type TargetExamResult<T> = { ok: true; value: T } | { ok: false; error: TargetExamRefusal };

// The Active Device (spec, Phase 3 → Active Device; ADR 0011). The token
// itself never reaches the seam: callers hash it first
// (src/lib/member-app/device-token.ts), and no read gives the hash back.

/** A Member's Active Device, as people see it: its label and when it was claimed. */
export interface ActiveDevice {
  /** "{Browser} on {OS}" from the User-Agent, such as "Chrome on Android", or "Unknown browser". */
  deviceLabel: string;
  /** ISO time the device was claimed. */
  claimedAt: string;
}

/** What a claim sends: the new token's hash, never the token, and the device's label. */
export interface DeviceClaim {
  /** The token's SHA-256, as 64 lowercase hex characters. */
  tokenHash: string;
  deviceLabel: string;
}

/** One claim in a Member's switch log: every claim, the first one too. */
export interface DeviceSwitch {
  /** The Member's User id. */
  userId: string;
  deviceLabel: string;
  /** ISO time of the claim. */
  switchedAt: string;
}

// The Library and opening a content item (spec, Phase 3 → Content model and
// Access decision seam). These are the content as it is, the same for every
// Member: what each Member may open is the access decision's answer
// (src/lib/member-app/access.ts), never part of these reads.

/** A deck, quiz or Reviewer PDF as the Library lists it: only Visible or Published ones. */
export interface LibraryItem {
  kind: ContentKind;
  id: string;
  freePreview: boolean;
}

/** One Topic in the Library, with the content Members can see, in deck, quiz, Reviewer PDF order. */
export interface LibraryTopic {
  id: string;
  name: string;
  /** Its place in its Subject's order, from 1. */
  position: number;
  /** Empty while nothing in it is Visible or Published: its content is still being prepared. */
  items: LibraryItem[];
}

/** One of an Exam's Subjects in the Library, with its Topics in order. */
export interface LibrarySubject {
  code: string;
  name: string;
  topics: LibraryTopic[];
}

/**
 * One deck, quiz or Reviewer PDF, as opening it needs: where it sits, and
 * what the access decision reads from it. A Hidden or unpublished one reads
 * too, so the Member is told it's no longer available.
 */
export interface ContentItem {
  kind: ContentKind;
  id: string;
  examCode: string;
  subjectCode: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  /** A Visible deck or quiz, or a Published Reviewer PDF. */
  available: boolean;
  freePreview: boolean;
}

// Studying a deck (spec, Phase 3 → Progress storage and Resume; ticket 08).
// The seam decides each deck with the access decision before it reads a
// card, and a refused deck's cards never leave it.

/** A card as the flashcard player shows it. */
export interface StudyCard {
  id: string;
  /** Its place in the deck's order, from 1. */
  position: number;
  /** The front, back and note, in the formula notation. */
  front: string;
  back: string;
  note: string | null;
  /** Its back image's signed URL, which stops working after about 10 minutes, or null. */
  imageUrl: string | null;
}

/** A deck the access decision opened, with the Member's own progress on it. */
export interface StudyDeck {
  /** In the deck's order. Empty while the deck has no cards: it's still being prepared. */
  cards: StudyCard[];
  /** The Member's latest mark on each card they have marked, by card id. */
  marks: Record<string, CardMarkVerdict>;
  /** The card they were on when they left the deck, or null to start at the first. */
  resumeAt: string | null;
  /** When the image URLs stop working (ISO), or null when no card has an image. */
  imagesExpireAt: string | null;
}

/** What opening a deck finds. */
export type DeckOpening =
  /** No such deck: a wrong address, or one that was deleted. */
  | { status: "not-found" }
  /** The access decision refused: no card is read. `marked` counts the Member's own Card Marks on it, kept. */
  | { status: "refused"; item: ContentItem; decision: RefusedDecision; marked: number }
  | { status: "allowed"; item: ContentItem; via: AllowedVia; deck: StudyDeck };

/** Why a study write was refused. A refused write changes nothing. */
export type StudyRefusal =
  /** No such card or deck, or a card that isn't in the deck. */
  | { reason: "not-found" }
  /** The access decision refused the card's deck. */
  | { reason: "refused"; decision: RefusedDecision };

export type StudyResult<T> = { ok: true; value: T } | { ok: false; refusal: StudyRefusal };

/** "Got it" or "Review again" on one card. */
export type CardMarkInput = z.input<typeof cardMarkInputSchema>;

/** Where the Member is in a deck: the card they're on, or null once they've finished it. */
export type DeckPositionInput = z.input<typeof deckPositionInputSchema>;

// Taking a quiz (spec, Phase 3 → Quizzes are graded on the server,
// Corrections never cost progress; ticket 11). The seam decides each quiz
// with the access decision before it reads a question, never sends a correct
// choice or an explanation before the Member submits, and marks the submit
// itself (src/lib/quizzes/grading.ts).

/** A question as the quiz screen shows it before the Member submits: never its correct choice or explanation. */
export interface QuizQuestion {
  id: string;
  /** The question and its four choices, in the formula notation. */
  question: string;
  choices: Record<QuizChoice, string>;
  /** Its figure's signed URL, which stops working after about 10 minutes, or null. */
  figureUrl: string | null;
}

/** One of the Member's Quiz Attempts, as the attempts list and the score screen show it. */
export interface AttemptSummary {
  id: string;
  /** ISO time it was submitted. */
  submittedAt: string;
  correctCount: number;
  questionCount: number;
  /** A whole percentage, rounded down. */
  score: number;
  /** The quiz's passing score when it was submitted. */
  passingScore: number;
  /** At or above that passing score. */
  passed: boolean;
}

/** A quiz the access decision opened, with the Member's own attempts on it. */
export interface StudyQuiz {
  passingScore: number;
  shuffle: boolean;
  showAnswers: boolean;
  /** In the quiz's order. Empty while the quiz has no questions: it's still being prepared. */
  questions: QuizQuestion[];
  /** When the figure URLs stop working (ISO), or null when no question has a figure. */
  imagesExpireAt: string | null;
  /** The highest score of the Member's attempts, or null before their first. */
  bestScore: number | null;
  /** The Member's attempts, newest first. */
  attempts: AttemptSummary[];
}

/** A quiz the access decision refused: nothing of it is read but the Member's own record on it, kept. */
export interface RefusedQuiz {
  status: "refused";
  item: ContentItem;
  decision: RefusedDecision;
  /** How many attempts the Member has made at it. */
  attemptCount: number;
  bestScore: number | null;
}

/** What opening a quiz finds. */
export type QuizOpening =
  /** No such quiz: a wrong address, or one that was deleted. */
  | { status: "not-found" }
  | RefusedQuiz
  | { status: "allowed"; item: ContentItem; via: AllowedVia; quiz: StudyQuiz };

/** A submitted attempt, marked: its score, the Best Score with it, and the review. */
export interface ScoredAttempt {
  attempt: AttemptSummary;
  bestScore: number;
  review: AttemptReview;
}

/** What opening one of the Member's past attempts finds. */
export type AttemptOpening =
  /** No such attempt of the Member's at this quiz: another Member's reads the same. */
  | { status: "not-found" }
  | RefusedQuiz
  | ({ status: "allowed"; item: ContentItem; via: AllowedVia } & ScoredAttempt);

/** Why a submit was refused. A refused submit saves nothing. */
export type QuizRefusal =
  | StudyRefusal
  /** It names a question that isn't in the quiz (one taken out of it since, too), or answers one twice. */
  | { reason: "mismatch" };

export type QuizResult<T> = { ok: true; value: T } | { ok: false; refusal: QuizRefusal };

/** What Submit sends: the attempt's own id, the quiz, and the Member's answers in the order seen. */
export type QuizSubmitInput = z.input<typeof quizSubmitSchema>;

/** One of the Member's past attempts at a quiz, as its address names it. */
export type AttemptRef = z.input<typeof attemptRefSchema>;

// Reading a Reviewer PDF (spec, Phase 3 → Burned-in watermark, Reviewer PDF
// reader, Progress storage and Resume; ticket 14). The seam decides each
// Reviewer PDF with the access decision before it reads a page, and only ever
// gives a page out stamped with the Member's own details: never clean.

/** A Reviewer PDF the access decision opened, with where the Member left it. */
export interface StudyReviewerPdf {
  /** How many pages it has: 0 while it has none yet (the sample data's, from before uploads). */
  pageCount: number;
  /** The page and zoom they left it at, or null to open at page 1, 100%. */
  resumeAt: ReaderPlace | null;
}

/** What opening a Reviewer PDF finds. */
export type ReviewerPdfOpening =
  /** No such Reviewer PDF, or one not placed under a Topic. */
  | { status: "not-found" }
  /** The access decision refused: no page is read. `viewed` counts the pages the Member viewed, kept. */
  | { status: "refused"; item: ContentItem; decision: RefusedDecision; viewed: number }
  | { status: "allowed"; item: ContentItem; via: AllowedVia; reviewerPdf: StudyReviewerPdf };

/** What asking for one page of a Reviewer PDF gives. */
export type ReviewerPage =
  /** No such Reviewer PDF or page: a page below 1 or past its last, or one whose image is gone. */
  | { status: "not-found" }
  /** The access decision refused: no page is read, and nothing is recorded. */
  | { status: "refused"; decision: RefusedDecision }
  /** The page, as a WebP stamped with the Member's email and short Member ID. */
  | { status: "page"; image: Uint8Array };

/** One page of a Reviewer PDF, as the page endpoint's address names it. */
export type ReviewerPageInput = z.input<typeof reviewerPageInputSchema>;

/** Where the Member is in a Reviewer PDF, as the reader saves it: its page and zoom. */
export type ReaderPositionInput = z.input<typeof readerPositionInputSchema>;

// A Member's progress (spec, Phase 3 → Progress calculator; ticket 15). The
// dashboard's read gives MemberProgress (src/lib/member-app/progress.ts);
// the Library's, each Topic's % on its own.

/** Each of an Exam's Topics' % done for a Member, by Topic id: null while a Topic has nothing to study. */
export type TopicPercents = Record<string, number | null>;

// ── In-app notices (ticket 17) ──────────────────────────────────────────────

/** What a notice tells the Member: a grant, an extension, or the end of their access. */
export const NOTICE_KINDS = ["granted", "extended", "ended"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/**
 * One in-app notice (spec, Phase 3 planning decisions → In-app notices): an
 * Owner's grant, extension or end of a Member's Access Pass, shown as a
 * dismissible banner until the Member dismisses it. No email is sent.
 */
export interface MemberNotice {
  id: string;
  /** The Member's User id: a notice is only ever shown to them. */
  userId: string;
  /** The Exam whose Access Pass changed. */
  examCode: string;
  kind: NoticeKind;
  /** ISO time the pass ends after the change (for "ended", when it ended). */
  endsAt: string;
  /** ISO time the Owner made the change. */
  createdAt: string;
  /** ISO time the Member dismissed it, or null while it shows. */
  dismissedAt: string | null;
}
