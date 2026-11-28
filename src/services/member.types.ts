import type { z } from "zod";

import type { AccessDecision, AllowedVia, RefusedDecision } from "@/lib/member-app/access";
import type { ExamDateSetBy } from "@/lib/member-app/exam-date";
import type { LessonRecord, LessonResume } from "@/lib/member-app/progress";
import type { InvoiceStatus } from "@/lib/payments/invoice-requests";
import type { Order } from "@/lib/payments/order-ledger";
import type { PrivacyRequestStatus, PrivacyRequestType } from "@/lib/member-app/privacy-requests";
import type { AttemptReview } from "@/lib/quizzes/grading";
import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { ReaderPlace } from "@/lib/reviewer-pdfs/reader";
import type { Plan } from "@/services/admin.types";
import type { CardMarkVerdict, ContentKind } from "@/services/content.types";
import type { CourseAccess } from "@/services/courses.types";
import type {
  attemptRefSchema,
  cardMarkInputSchema,
  deckPositionInputSchema,
  lessonCompleteInputSchema,
  lessonPositionInputSchema,
  lessonRefSchema,
  quizSubmitSchema,
  readerPositionInputSchema,
  reviewerPageInputSchema,
} from "@/services/member.schema";
import type { PlaybackPass } from "@/services/video.types";

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

// Watching video Courses (Phase 5, ticket 03; spec, Phase 5 planning
// decisions → Access and playback, The Courses screen; course-study.core.ts).
// The seam decides every Course and Lesson with the access decision, from the
// Course as it is now and the Member's own Course Ownership, and asks the
// video service for a playback pass only once it allows the Lesson.

/** A Course as the Courses screen and its page show it to the Member asking. */
export interface MemberCourse {
  id: string;
  examCode: string;
  subjectCode: string;
  title: string;
  /** Plain text; may be empty. */
  description: string;
  /** The 16:9 cover's URL, or null for the Subject block. */
  coverSrc: string | null;
  access: CourseAccess;
  /** The one-time price in centavos, or null until an Owner sets one. */
  priceCentavos: number | null;
  onSale: boolean;
  /** Visible; a Hidden one shows only to the Members who own it. */
  visible: boolean;
  /** The Member holds Course Ownership of it. */
  owned: boolean;
  /** Its Modules with a Published Lesson. */
  modules: number;
  /** Its Published Lessons. */
  lessons: number;
  /** Its Published Free Preview Lessons. */
  freePreviewLessons: number;
  /** The first Published Lesson, where "Start course" goes; null with none. */
  firstLessonId: string | null;
  /** The first Published Free Preview Lesson, where "Watch free" goes; null with none. */
  firstFreeLessonId: string | null;
  /** The access decision on its Lessons that aren't Free Preview: the card's state. */
  decision: AccessDecision;
  /** Its Published Lessons the Member has done: the card's "9 / 32". */
  lessonsDone: number;
  /**
   * Where the card's "Continue: {Lesson} →" goes: the Lesson watched last
   * that isn't done, or the first not done; null before any watching or once
   * every Lesson is done ("Start course").
   */
  continueLesson: { id: string; title: string } | null;
}

/** The Courses screen's shelf for one Exam. */
export interface CourseShelf {
  /** The Exam's Subjects, in the Exam's order. */
  subjects: { code: string; name: string }[];
  /** Its Visible Courses and the Hidden ones the Member owns, oldest first. */
  courses: MemberCourse[];
}

/** One Published Lesson in a Course's list. */
export interface MemberLesson {
  id: string;
  /** Its place among its Module's Published Lessons, from 1. */
  number: number;
  title: string;
  /** The video's length in whole seconds. */
  seconds: number;
  freePreview: boolean;
  /** The access decision allows the Member to play it. */
  playable: boolean;
  /** The Member has done it (✓ in the side panel). */
  done: boolean;
}

/** One Module with a Published Lesson, and those Lessons, in order. */
export interface MemberModule {
  id: string;
  /** Its place among the Modules shown, from 1. */
  number: number;
  title: string;
  lessons: MemberLesson[];
}

/** A Course the access decision refused outright (the gate, the device, or Hidden from a non-owner). */
export interface RefusedCourse {
  status: "refused";
  course: MemberCourse;
  decision: RefusedDecision;
}

/** What opening a Course's page finds. Locked Courses open too: only their Free Preview Lessons play. */
export type CourseOpening =
  /** No Course with this id. */
  | { status: "not-found" }
  | RefusedCourse
  | { status: "open"; course: MemberCourse; outline: MemberModule[] };

/** The Lesson being opened, with where it sits. */
export interface OpenedLesson extends MemberLesson {
  /** Shown under the video: plain text with line breaks; may be empty. */
  notes: string;
  /** Its Module's place among the Modules shown, from 1. */
  moduleNumber: number;
  /** Where its video starts for the Member: the saved position, or the beginning once done. */
  resume: LessonResume;
}

/** What plays in place of the video. */
export type LessonPlayer =
  /** A playback pass for the Member's Active Device, drawing `watermark` across the video. */
  | { kind: "pass"; pass: PlaybackPass; seconds: number; watermark: string }
  /** The video service isn't connected (no key): "This video isn't available yet". */
  | { kind: "not-connected" }
  /** The video service didn't give a pass. */
  | { kind: "didnt-answer" };

/** A Lesson as its address names it: its Course, and itself. */
export type LessonRef = z.input<typeof lessonRefSchema>;

/** What opening a Lesson finds. */
export type LessonOpening =
  /** No such Lesson, or not in the Course its address names. */
  | { status: "not-found" }
  /** The access decision refused: no pass is asked for. */
  | {
      status: "refused";
      course: MemberCourse;
      lesson: { id: string; title: string };
      decision: RefusedDecision;
    }
  | {
      status: "allowed";
      course: MemberCourse;
      outline: MemberModule[];
      lesson: OpenedLesson;
      via: AllowedVia;
      player: LessonPlayer;
    };

/** Where the Member is in a Lesson's video, as the player saves it. */
export type LessonPositionInput = z.input<typeof lessonPositionInputSchema>;

/** "Mark complete" on a Lesson. */
export type LessonCompleteInput = z.input<typeof lessonCompleteInputSchema>;

/** Why a Lesson save was refused. A refused save stores nothing. */
export type LessonSaveRefusal =
  | StudyRefusal
  /** A position below 0 or past the Lesson's length. */
  | { reason: "out-of-range" };

/** A Lesson save: the Member's progress in it after the save, or why nothing was stored. */
export type LessonSaveResult =
  { ok: true; value: LessonRecord } | { ok: false; refusal: LessonSaveRefusal };

/** Where the Member is in a Reviewer PDF, as the reader saves it: its page and zoom. */
export type ReaderPositionInput = z.input<typeof readerPositionInputSchema>;

// A Member's progress (spec, Phase 3 → Progress calculator; ticket 15). The
// dashboard's read gives MemberProgress (src/lib/member-app/progress.ts);
// the Library's, each Topic's % on its own.

/** Each of an Exam's Topics' % done for a Member, by Topic id: null while a Topic has nothing to study. */
export type TopicPercents = Record<string, number | null>;

// ── In-app notices (ticket 17) ──────────────────────────────────────────────

/**
 * What a notice tells the Member: a grant, an extension, the end of their
 * access, or a full refund in PayMongo (Phase 4, ticket 09).
 */
export const NOTICE_KINDS = ["granted", "extended", "ended", "refunded", "shortened"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/**
 * One in-app notice (spec, Phase 3 planning decisions → In-app notices): an
 * Owner's grant, extension or end of a Member's Access Pass ("shortened" when
 * ending its granted days leaves paid ones, ticket 10), or a full refund
 * (ticket 09), shown as a dismissible banner until the Member dismisses it.
 * No email is sent.
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
  /** The refunded Order's reference, "AYC-10483", for a refund's notice; null for any other. */
  reference: string | null;
}

// ── Privacy Requests (ticket 18) ────────────────────────────────────────────

/**
 * One Privacy Request (spec, Phase 3 → Privacy Requests): a Member's ask, from
 * Account, for a copy of their data or for their account to be deleted. Owners
 * carry it out by hand (ticket 19). Nothing is emailed automatically.
 */
export interface PrivacyRequest {
  id: string;
  /** The Member's User id: a Member only ever sees their own. */
  userId: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  /** ISO time the Member asked. */
  requestedAt: string;
  /** The Manila date (YYYY-MM-DD) it's due: 7 days for a copy, 30 for a deletion. */
  dueOn: string;
}

/** What asking gives: the Member's open request of that type, and whether this ask made it. */
export interface PrivacyRequestOutcome {
  request: PrivacyRequest;
  /** False when one was already open: nothing new is made. */
  created: boolean;
}

// ── Plans (Phase 4, ticket 02; spec, Phase 4 planning decisions → Who buys,
// and which Exams; stories 134 and 151c) ─────────────────────────────────────

/** A Plan on sale, as the Member's Plans page shows it: its name ("CE All-Access"), days, price and Best value. */
export type OnSalePlan = Pick<Plan, "id" | "name" | "days" | "priceCentavos" | "bestValue">;

/** An Exam with at least one Plan on sale, as one Member's Plans page reads it. */
export interface PlansExam {
  examCode: string;
  board: string;
  name: string;
  /** Its Plans on sale, shortest first. Never empty. */
  plans: OnSalePlan[];
  /** When this Member's own Access Pass for the Exam ends (ISO), ended or not; null with none. */
  passEndsAt: string | null;
  /**
   * The Exam Date a Plan would count towards (YYYY-MM-DD): the Member's own
   * for a Target Exam, else the Exam's Official Exam Date, which buying it
   * adds it with; null when there's neither.
   */
  examDate: string | null;
}

// ── Buying (Phase 4, ticket 03; spec, Phase 4 → Order ledger, Return flow;
// Phase 4 planning decisions → Paying; stories 135–140) ───────────────────────

/** What the Plans page's Pay sends: the Exam open on the page, the Plan picked and the method. */
export interface PayInput {
  examCode: string;
  planId: string;
  method: string;
}

/**
 * Why Pay made no Order: buying isn't set up on this server, the method isn't
 * one of the four, the Plan isn't on sale (or isn't a Plan), or it's another
 * Exam's than the one posted.
 */
export type PayRefusal =
  "unavailable" | "bad-method" | "not-on-sale" | "wrong-exam" | "checkout-failed";

/** Pay's outcome: the Pending Order's reference and where to send the Member, or why not. */
export type PayResult =
  { ok: true; reference: string; redirectTo: string } | { ok: false; reason: PayRefusal };

/**
 * One of the Member's own Paid Orders as its Payment Acknowledgement shows
 * it (ticket 06): the Order, who was billed as at Pay, the access period its
 * days gave (from, until), and PayMongo's reference, null with the fake.
 */
export interface PaymentAcknowledgement {
  order: MemberOrder;
  buyer: { name: string | null; email: string };
  access: { startsAt: string; endsAt: string } | null;
  payMongoReference: string | null;
}

/** An Order's Invoice Request as the Member sees it (ticket 08): requested, then sent. */
export interface MemberInvoice {
  status: InvoiceStatus;
  requestedAt: string;
  sentAt: string | null;
}

/** Why "Request official invoice" was refused: no Order of theirs, not Paid, or asked already. */
export type InvoiceRefusal = "not-found" | "not-paid" | "already-requested";

/** The form's fields, each with what was wrong with it. */
export type InvoiceFieldErrors = Partial<Record<"name" | "address" | "tin", string>>;

/** "Request official invoice"'s outcome. */
export type InvoiceRequestResult =
  | { ok: true }
  | { ok: false; reason: InvoiceRefusal }
  | { ok: false; reason: "invalid"; fields: InvoiceFieldErrors };

/** What a PayMongo webhook event did (ticket 05). */
export type PaymentEventResult =
  "applied" | "no-change" | "duplicate" | "unknown-order" | "ignored";

/**
 * What the daily sweep did: the overdue Pending Orders it asked PayMongo
 * about, how many became Paid or Expired, and how many were left Pending
 * because PayMongo couldn't answer (or settling failed). An Order moved on
 * by a webhook meanwhile is in none of the last three.
 */
export interface ExpirySweep {
  checked: number;
  paid: number;
  expired: number;
  unanswered: number;
}

/**
 * One of the Member's own Orders, as the Confirming payment, Paid and Failed
 * screens show it. Its status is as at the read: a Pending Order older than
 * 24 hours reads Expired (ticket 05).
 */
export type MemberOrder = Pick<
  Order,
  | "id"
  | "reference"
  | "examCode"
  | "planName"
  | "days"
  | "priceCentavos"
  | "method"
  | "status"
  | "createdAt"
  | "paidAt"
  | "livemode"
> & {
  /** Once Paid: the end of the Access Pass the Order's days gave (ISO); null until then. */
  accessUntil: string | null;
  /** Whether its payment was confirmed more than 24 hours after it was made (ticket 05). */
  paidAfterExpiry: boolean;
  /** Its Invoice Request (ticket 08), or null for none. */
  invoice: MemberInvoice | null;
  /**
   * What PayMongo refunded of it, in centavos (ticket 09): its succeeded
   * refunds. Less than its price on a Paid Order is a partial refund.
   */
  refundedCentavos: number;
  /** When its last refund was made (ISO), or null with none. */
  refundedAt: string | null;
};
