import { isDatabaseConfigured } from "@/env.server";
import type { MemberAccess } from "@/lib/member-app/access";
import type { DeviceStatus } from "@/lib/member-app/device-token";
import type { AccessPass, CardMark, ContentKind, DeckPosition } from "@/services/content.types";
import { databaseArm } from "@/services/member.db";
import * as mockImpl from "@/services/member.mock";
import type {
  ActiveDevice,
  AddedTargetExam,
  AgreedVersions,
  AttemptOpening,
  AttemptRef,
  CardMarkInput,
  ConsentRecord,
  ContentItem,
  DeckOpening,
  DeckPositionInput,
  DeviceClaim,
  DeviceSwitch,
  LibrarySubject,
  Member,
  MemberUser,
  NewTargetExam,
  PickableExam,
  QuizOpening,
  QuizResult,
  QuizSubmitInput,
  ScoredAttempt,
  StudyResult,
  TargetExam,
  TargetExamResult,
} from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// Member Service Seam (spec, Phase 3 → Phase 3 seams). Everything the Member
// App reads and writes for the signed-in Member goes through here: Member App
// pages and Server Actions never touch the sample store or the database. Like
// src/services/admin.ts, this module is a thin SELECTOR: the database arm
// (member.db.ts) when DATABASE_URL is set, the sample arm otherwise, behind
// the same contract. Reads are always fresh and never cached.
//
// The seam trusts its caller for who is signed in: the Member App gate
// (src/lib/member-app/guard.ts) passes the User that sign-in verified, never
// anything the browser sent. Each read and write is scoped to that User's own
// records, the study records too (Card Marks, Study Days and deck positions).
// ─────────────────────────────────────────────────────────────────────────────

/** The seam's public contract, checked against each arm below. */
export interface MemberService {
  /**
   * The Member App gate's read: whether this email is on the Beta Tester list
   * now (case-insensitive). A removed tester, or a malformed email, isn't.
   * The caller passes only an email that sign-in verified.
   */
  isBetaTester(email: string): Promise<boolean>;
  /**
   * The Member record of a User who passed the gate, made on their first
   * pass with their name and email from Google, lowercased. Later calls give
   * the same record unchanged. Throws for a User id or email that isn't one.
   */
  getOrCreateMember(user: MemberUser): Promise<Member>;
  /**
   * The consent check's read: this Member's latest agreement to the Terms
   * and Privacy Policy, or null when they have never agreed. Only ever their
   * own. Throws for a User id that isn't one.
   */
  latestConsent(userId: string): Promise<ConsentRecord | null>;
  /**
   * Adds an agreement to this Member's consent history, timed now. Earlier
   * agreements are kept unchanged. The caller checks the versions are the
   * current ones; the seam refuses versions that aren't versions, and a User
   * with no Member record (someone the gate never let in).
   */
  recordConsent(userId: string, versions: AgreedVersions): Promise<ConsentRecord>;

  // Target Exams (spec, Phase 3 → Target Exams). Each call is scoped to the
  // User id given: a Member only ever reads or changes their own. The changes
  // answer a refusal for what a Member could send (a wrong Exam or date), and
  // throw for a User id that isn't one or has no Member record.

  /**
   * The Exams a Member can pick: those on the Website, in the catalogue's
   * order, each with its Official Exam Date. Read fresh, like everything here.
   */
  listPickableExams(): Promise<PickableExam[]>;
  /**
   * This Member's Target Exams, in the order added, without the ones they
   * removed. Each Exam Date is the Member's own once they have set one, and
   * the Exam's Official Exam Date as it is now until then. Exactly one is
   * selected: the one they last selected, or the first when that's gone.
   */
  listTargetExams(userId: string): Promise<TargetExam[]>;
  /**
   * Adds an Exam on the Website to this Member's Target Exams, and selects
   * it. A date equal to the Official Exam Date, or none, follows the Official
   * Exam Date; any other is the Member's own, and must not have passed. An
   * Exam with no Official Exam Date needs one. An Exam the Member removed
   * earlier is restored, with the date it had. Refused for one that's already
   * theirs.
   */
  addTargetExam(userId: string, input: NewTargetExam): Promise<TargetExamResult<AddedTargetExam>>;
  /** Sets this Member's own Exam Date for one of their Target Exams: a real date that hasn't passed. */
  setExamDate(
    userId: string,
    examCode: string,
    examDate: string,
  ): Promise<TargetExamResult<TargetExam>>;
  /** Makes one of this Member's Target Exams the selected one, remembered until they switch again. */
  selectTargetExam(userId: string, examCode: string): Promise<TargetExamResult<TargetExam>>;
  /**
   * Removes one of this Member's Target Exams, keeping its record so adding
   * it back restores it. Refused for their last one. When the selected one is
   * removed, the selection falls back to the first one remaining.
   */
  removeTargetExam(userId: string, examCode: string): Promise<TargetExamResult<TargetExam>>;

  // The Active Device (spec, Phase 3 → Active Device; ADR 0011). Each call is
  // scoped to the User id given. The seam only ever receives a token's hash:
  // the caller hashes the device's token (src/lib/member-app/device-token.ts),
  // so the token itself is never stored or logged, and no read gives the hash
  // back. The Admin never calls these.

  /**
   * Makes the device holding this token hash the Member's Active Device,
   * replacing the one before, and adds the claim to their switch log, timed
   * now. Every claim is logged, the first one too. Refuses anything but a
   * SHA-256 hash (a raw token above all), a blank or overlong label, and a
   * User with no Member record.
   */
  claimDevice(userId: string, claim: DeviceClaim): Promise<ActiveDevice>;
  /**
   * Is this request from the Member's Active Device? "no-token" when the
   * request carries no token; "active" when its hash matches the Member's
   * Active Device, compared in constant time; "replaced" for any other value,
   * including one Member's token sent for another and a Member with no Active
   * Device yet. Never "active" for a tampered or unknown token.
   */
  deviceStatus(userId: string, tokenHash: string | null): Promise<DeviceStatus>;
  /** The Member's Active Device's label and claim time, or null before their first claim. */
  getActiveDevice(userId: string): Promise<ActiveDevice | null>;
  /** The Member's switch log, oldest first: every claim, the first one too. */
  listDeviceSwitches(userId: string): Promise<DeviceSwitch[]>;
  /** How many claims the Member's switch log holds. */
  deviceSwitchCount(userId: string): Promise<number>;

  // The Library and content (spec, Phase 3 → Content model and Access
  // decision seam). The content reads are the same for every Member: what one
  // may open is the access decision's answer (src/lib/member-app/access.ts),
  // which src/lib/member-app/access-check.ts asks with these reads. Nothing
  // reads protected content around it.

  /**
   * An Exam's Library: each of its Subjects in the catalogue's order, each
   * with its Topics in order, each with its Visible decks and quizzes and
   * Published Reviewer PDFs only. Nothing for a code that isn't an Exam's.
   */
  getLibrary(examCode: string): Promise<LibrarySubject[]>;
  /**
   * One deck, quiz or Reviewer PDF, Hidden or not, with where it sits and
   * what the access decision reads from it. Null for an id or kind that isn't
   * one (the address is the browser's), and for a Reviewer PDF not yet placed
   * under a Topic.
   */
  getContentItem(kind: ContentKind, id: string): Promise<ContentItem | null>;
  /**
   * This Member's Access Passes, at most one per Exam, ended ones too: only
   * ever their own. Throws for a User id that isn't one.
   */
  listAccessPasses(userId: string): Promise<AccessPass[]>;

  // Studying a deck (spec, Phase 3 → Progress storage and Resume; ticket 08;
  // deck-study.core.ts). Each call takes the signed-in Member's side of the
  // access decision, which the server gathered for this request
  // (src/lib/member-app/access-check.ts), and decides the deck with it first:
  // a refused deck's cards are never given out, and nothing is written. Each
  // is scoped to the User id given.

  /**
   * Opens a deck. When the access decision allows it: its cards in order, each
   * back image as a signed URL from the private bucket that stops working
   * after about 10 minutes, the Member's latest mark on each card, and the
   * card they left the deck at. Refused (locked, expired, Hidden, a replaced
   * device): the decision and how many of its cards they had marked, with no
   * card. Not found for an id that isn't a deck's.
   */
  openDeck(userId: string, deckId: string, access: MemberAccess): Promise<DeckOpening>;
  /**
   * Saves the Member's mark on a card, replacing their earlier one (the latest
   * wins), and records the day it's marked, in Asia/Manila, as a Study Day,
   * once per day. Refused, changing nothing, when the access decision refuses
   * the card's deck; not found for a card that isn't one. Throws for a
   * verdict that isn't one, and a User with no Member record.
   */
  markCard(
    userId: string,
    input: CardMarkInput,
    access: MemberAccess,
  ): Promise<StudyResult<CardMark>>;
  /**
   * Saves the card the Member is on in a deck, which the deck then opens at;
   * with no card, clears it, once they finish the deck. Refused like
   * markCard; not found for a deck that isn't one or a card not in it.
   */
  saveDeckPosition(
    userId: string,
    input: DeckPositionInput,
    access: MemberAccess,
  ): Promise<StudyResult<DeckPosition | null>>;
  /** The Member's Study Days, oldest first, as Asia/Manila dates (YYYY-MM-DD). */
  listStudyDays(userId: string): Promise<string[]>;

  // Taking a quiz (spec, Phase 3 → Quizzes are graded on the server,
  // Corrections never cost progress; ticket 11; quiz-study.core.ts). Each call
  // takes the signed-in Member's side of the access decision, as the study
  // calls do, and decides the quiz with it first: a refused quiz's questions
  // are never given out, and nothing is written. No question read carries a
  // correct choice or an explanation. Each is scoped to the User id given:
  // a Member only ever reads their own attempts.

  /**
   * Opens a quiz. When the access decision allows it: its settings, its
   * questions in order without their correct choices or explanations, each
   * figure as a signed URL that stops working after about 10 minutes, the
   * Member's Best Score (the highest of their scores) and their attempts,
   * newest first. Refused (locked, expired, Hidden, a replaced device): the
   * decision, how many attempts they made and their Best Score, with no
   * question. Not found for an id that isn't a quiz's.
   */
  openQuiz(userId: string, quizId: string, access: MemberAccess): Promise<QuizOpening>;
  /**
   * Marks a submit against the quiz as it is now, and saves it as a Quiz
   * Attempt with its score and answers, recording the day, in Asia/Manila,
   * as a Study Day. Every question in the quiz counts: one left unanswered or
   * left out is wrong. Gives the attempt, the Best Score with it, and the
   * review (the correct answers and explanations only when the quiz shows
   * answers after). The same attempt id posted again saves nothing and gives
   * the first marking. Refused, saving nothing, when the access decision
   * refuses the quiz; a mismatch when it names a question that isn't in the
   * quiz (one taken out of it since the attempt started, too) or answers one
   * twice; not found for a quiz that isn't one or an
   * attempt id another Member or quiz used. Throws for a submit the quiz
   * screen can't send (an attempt id that isn't one, a choice that isn't
   * A–D) and a User with no Member record.
   */
  submitQuiz(
    userId: string,
    input: QuizSubmitInput,
    access: MemberAccess,
  ): Promise<QuizResult<ScoredAttempt>>;
  /**
   * Opens one of the Member's past attempts at a quiz: its score, the Best
   * Score, and its review under the quiz's "show answers after" as it is
   * now, with a question removed since as removed. Refused like openQuiz;
   * not found for an attempt that isn't the Member's at this quiz.
   */
  reviewQuizAttempt(userId: string, ref: AttemptRef, access: MemberAccess): Promise<AttemptOpening>;
}

const impl: MemberService = isDatabaseConfigured ? databaseArm : mockImpl;

export const isBetaTester = impl.isBetaTester;
export const getOrCreateMember = impl.getOrCreateMember;
export const latestConsent = impl.latestConsent;
export const recordConsent = impl.recordConsent;
export const listPickableExams = impl.listPickableExams;
export const listTargetExams = impl.listTargetExams;
export const addTargetExam = impl.addTargetExam;
export const setExamDate = impl.setExamDate;
export const selectTargetExam = impl.selectTargetExam;
export const removeTargetExam = impl.removeTargetExam;
export const claimDevice = impl.claimDevice;
export const deviceStatus = impl.deviceStatus;
export const getActiveDevice = impl.getActiveDevice;
export const listDeviceSwitches = impl.listDeviceSwitches;
export const deviceSwitchCount = impl.deviceSwitchCount;
export const getLibrary = impl.getLibrary;
export const getContentItem = impl.getContentItem;
export const listAccessPasses = impl.listAccessPasses;
export const openDeck = impl.openDeck;
export const markCard = impl.markCard;
export const saveDeckPosition = impl.saveDeckPosition;
export const listStudyDays = impl.listStudyDays;
export const openQuiz = impl.openQuiz;
export const submitQuiz = impl.submitQuiz;
export const reviewQuizAttempt = impl.reviewQuizAttempt;
