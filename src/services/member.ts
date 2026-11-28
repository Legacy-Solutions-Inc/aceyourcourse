import { isDatabaseConfigured } from "@/env.server";
import type { MemberAccess } from "@/lib/member-app/access";
import type { MemberProgress } from "@/lib/member-app/progress";
import type { PrivacyRequestType } from "@/lib/member-app/privacy-requests";
import type { DeviceStatus } from "@/lib/member-app/device-token";
import type { RenewalReminder } from "@/lib/member-app/renewal";
import type { ReaderPlace } from "@/lib/reviewer-pdfs/reader";
import type { AccessPass, CardMark, ContentKind, DeckPosition } from "@/services/content.types";
import type { PageStamper } from "@/services/page-images.types";
import type { PaymentEvent, PaymentsClient } from "@/services/payments.types";
import { databaseArm } from "@/services/member.db";
import type { InvoiceRequestInput } from "@/services/member.schema";
import type { RenewalViewer } from "@/services/renewal.core";
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
  MemberNotice,
  ExpirySweep,
  InvoiceRequestResult,
  MemberOrder,
  PaymentAcknowledgement,
  PaymentEventResult,
  MemberUser,
  NewTargetExam,
  PayInput,
  PayResult,
  PickableExam,
  PlansExam,
  PrivacyRequest,
  PrivacyRequestOutcome,
  QuizOpening,
  QuizResult,
  QuizSubmitInput,
  ReaderPositionInput,
  ReviewerPage,
  ReviewerPageInput,
  ReviewerPdfOpening,
  ScoredAttempt,
  StudyResult,
  TargetExam,
  TargetExamResult,
  TopicPercents,
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
// records, the study records too (Card Marks, Study Days, deck positions,
// Quiz Attempts, Reviewer PDF pages viewed and places).
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

  // Reading a Reviewer PDF (spec, Phase 3 → Burned-in watermark, Reviewer PDF
  // reader, Progress storage and Resume; ticket 14; reviewer-study.core.ts).
  // Each call takes the signed-in Member's side of the access decision, as
  // the study calls do, and decides the Reviewer PDF with it first: a refused
  // one's pages are never read, and nothing is written. A page is only ever
  // given out stamped with the Member's own email and short Member ID, never
  // clean. Each is scoped to the User id given.

  /**
   * Opens a Reviewer PDF. When the access decision allows it: how many pages
   * it has (0 for one with none yet), and the page and zoom the Member left
   * it at. Refused (locked, expired, Draft or
   * Unpublished, a replaced device): the decision and how many pages they
   * viewed, with no page. Not found for an id that isn't a placed Reviewer
   * PDF's.
   */
  openReviewerPdf(
    userId: string,
    reviewerPdfId: string,
    access: MemberAccess,
  ): Promise<ReviewerPdfOpening>;
  /**
   * One page, for the page endpoint: when the access decision allows its
   * Reviewer PDF, the page's image stamped by `stamper` with the Member's
   * email and short Member ID. Records the page as viewed, once per Member
   * and page, and the day, in Asia/Manila, as a Study Day. Refused, reading
   * and recording nothing, when the decision refuses; not found for a
   * Reviewer PDF that isn't one, a page below 1 or past its last (or not a
   * whole number), or one whose image is gone. Throws for a User with no
   * Member record.
   */
  readReviewerPage(
    userId: string,
    input: ReviewerPageInput,
    access: MemberAccess,
    stamper: PageStamper,
  ): Promise<ReviewerPage>;
  /**
   * Saves the page and zoom the Member is at in a Reviewer PDF, which it then
   * reopens at, replacing their earlier place in it. Refused, saving nothing,
   * when the access decision refuses; not found for a Reviewer PDF that
   * isn't one or a page it doesn't have. Throws for a zoom the reader doesn't
   * offer, and a User with no Member record.
   */
  saveReaderPosition(
    userId: string,
    input: ReaderPositionInput,
    access: MemberAccess,
  ): Promise<StudyResult<ReaderPlace>>;

  // Progress (spec, Phase 3 → Progress calculator, Progress storage, Resume,
  // Corrections never cost progress; ticket 15; progress.core.ts). Reads
  // only, with every number from the pure calculator
  // (src/lib/member-app/progress.ts) over the Member's own records. There's
  // no access decision: progress is the Member's own, still shown when their
  // access ends, and Hidden or Draft content counts nowhere. Each is scoped to
  // the User id given, and throws for one that isn't a User id.

  /**
   * The dashboard's read: the Member's progress in one Exam (each Subject's
   * and Topic's %, cards got, the quiz average, the 3 weakest Topics, the last
   * deck and Reviewer PDF page to continue) and their Study Streak, which is
   * account-wide. Nothing for a code that isn't an Exam's. The Member detail
   * page (ticket 16) can show the same, per Target Exam.
   */
  getProgress(userId: string, examCode: string): Promise<MemberProgress>;
  /** The Library's read: each of the Exam's Topics' % done for the Member, by Topic id. */
  getTopicPercents(userId: string, examCode: string): Promise<TopicPercents>;

  // In-app notices (ticket 17; spec, Phase 3 planning decisions → In-app
  // notices): what an Owner's grant, extension or end of the Member's Access
  // Pass tells them, as one dismissible banner each. The Admin seam writes
  // them (access-passes.core.ts). There's no email and no notification
  // centre. Each call is scoped to the User id given, and throws for one
  // that isn't a User id.

  /**
   * The notices the Member App shows this Member: each Exam's latest, unless
   * they dismissed it, newest first (src/lib/member-app/notices.ts). Only
   * ever their own.
   */
  listNotices(userId: string): Promise<MemberNotice[]>;
  /**
   * Dismisses one of this Member's notices, for good and on every device.
   * True when it's theirs, dismissed before too (the first time is kept);
   * false, changing nothing, for an id no notice of theirs has: another
   * Member's above all.
   */
  dismissNotice(userId: string, noticeId: string): Promise<boolean>;

  // Renewal reminders (Phase 4, ticket 12; spec, Phase 4 planning decisions →
  // Renewal reminders; renewal.core.ts): one banner per Exam whose Access
  // Pass ends within the next 7 Manila days, on Home and that Exam's study
  // screens. Each call is scoped to the User id given, and throws for one
  // that isn't a User id. No email is sent.

  /**
   * The reminders this Member sees now, soonest end first, each with the
   * Manila days its end falls before their Exam Date (null on or after it, or
   * with none). Those they dismissed today are left out, and Staff get none.
   */
  listRenewalReminders(userId: string, viewer: RenewalViewer): Promise<RenewalReminder[]>;
  /**
   * Dismisses one Exam's reminder for this Member until the next Manila day,
   * on every device. True when they hold a pass for that Exam; false,
   * keeping nothing, otherwise.
   */
  dismissRenewalReminder(userId: string, examCode: string): Promise<boolean>;

  // Privacy Requests (ticket 18; spec, Phase 3 → Privacy Requests; Privacy
  // Policy §14): a Member asks from Account for a copy of their data or for
  // their account to be deleted, and Owners carry it out by hand (ticket 19).
  // Each call is scoped to the User id given: a Member only ever reads or
  // makes their own. Nothing is emailed.

  /** This Member's open Privacy Requests, oldest first: at most one of each type. Only ever their own. */
  listOpenPrivacyRequests(userId: string): Promise<PrivacyRequest[]>;
  /**
   * Asks for a data copy (due in 7 days) or a deletion (due in 30), counted
   * in Manila days from today, timed now. While one of the type is open, it
   * makes nothing and gives that one. Throws for a type that isn't one, a
   * User id that isn't one, and a User with no Member record.
   */
  requestPrivacy(userId: string, type: PrivacyRequestType): Promise<PrivacyRequestOutcome>;

  // Plans (Phase 4, ticket 02; spec, Phase 4 planning decisions → Who buys,
  // and which Exams; Phase 4 seams → Member seam, extended). Reads only, fresh
  // each time: an Owner switching a Plan off takes it off the Plans page on
  // the next request. Buying comes with ticket 03.

  /**
   * The Plans page's read for this Member: each Exam on the Website with at
   * least one Plan on sale, in the catalogue's order, with its Plans on sale
   * shortest first, when the Member's own Access Pass for it ends, and the
   * Exam Date a Plan would count towards (theirs for a Target Exam, otherwise
   * the Official Exam Date). Never another Member's pass or date. Throws for
   * a User id that isn't one.
   */
  listMemberPlans(userId: string): Promise<PlansExam[]>;
  /**
   * The codes of the Exams on the Website with at least one Plan on sale, in
   * the catalogue's order: where a lock's "See plans" can lead. The same for
   * every Member.
   */
  listExamsOnSale(): Promise<string[]>;

  // Buying (Phase 4, ticket 03; spec, Phase 4 → Order ledger, Return flow,
  // References; Phase 4 planning decisions → Paying; orders.core.ts). Each
  // call is scoped to the User id given: a Member only ever buys for, reads
  // or checks their own Orders. The payments client is the one this server
  // has (payments.ts), or null when buying isn't set up.

  /**
   * Pay: makes a new Pending Order for this Member, every call, with the
   * Plan's name, days and price as they are now (later changes to the Plan
   * never touch it), the method and a reference from AYC-10001 upward, then
   * starts the checkout for it. Gives the reference and where to send the
   * Member. Refused, making nothing, with no payments client, a method that
   * isn't one of the four, a Plan that isn't on sale for an Exam on the
   * Website, and a Plan of another Exam than the one posted. Refused too
   * when the checkout can't start, leaving the Order Pending. Throws for a
   * User id that isn't one.
   */
  payForPlan(userId: string, input: PayInput, client: PaymentsClient | null): Promise<PayResult>;
  /** One of this Member's own Orders by its reference; null for anyone else's, or none. */
  getMemberOrder(userId: string, reference: string): Promise<MemberOrder | null>;
  /**
   * Billing (ticket 06): every Order of this Member's, newest first, as at
   * the read (a Pending Order older than 24 hours reads Expired).
   */
  listMemberOrders(userId: string): Promise<MemberOrder[]>;
  /**
   * The Payment Acknowledgement of one of this Member's own Paid Orders
   * (ticket 06): null for anyone else's Order, one that isn't Paid, or none.
   */
  getPaymentAcknowledgement(
    userId: string,
    reference: string,
  ): Promise<PaymentAcknowledgement | null>;
  /**
   * "Request official invoice" (ticket 08): records the name, address and
   * TIN to put on the official invoice of one of this Member's own Paid
   * Orders, once. Refused for anyone else's Order (as not found), one that
   * isn't Paid, a second request, or a form with a field wrong. No email.
   */
  requestInvoice(
    userId: string,
    reference: string,
    input: InvoiceRequestInput,
  ): Promise<InvoiceRequestResult>;
  /**
   * Asks the payments client for a Pending Order's checkout status, applies
   * a Paid or Failed outcome through the Order ledger, and gives the Order as
   * it is then. Paid adds its days to the Member's Access Pass, keeps them as
   * a paid history row, adds the Exam to their Target Exams if it isn't one,
   * leaves a notice and logs Staff Activity under "PayMongo (system)", all or
   * nothing, once. With no client, or an Order no longer Pending, it changes
   * nothing. Null for anyone else's Order, or none.
   */
  checkOrderStatus(
    userId: string,
    reference: string,
    client: PaymentsClient | null,
  ): Promise<MemberOrder | null>;
  /**
   * The status-check backup (ticket 04), for the Confirming payment screen:
   * checkOrderStatus, but asking the payments client at most once every 10
   * seconds per Order, however many screens or servers poll. A poll inside
   * that time changes nothing and gives the Order as it is.
   */
  pollOrderStatus(
    userId: string,
    reference: string,
    client: PaymentsClient | null,
  ): Promise<MemberOrder | null>;
  /**
   * A verified PayMongo webhook event (ticket 05): applied once, by its id,
   * to the Order it's about (by its checkout's id, or our id or reference
   * from the checkout's metadata), through the same ledger as the status
   * check, and logged in Staff Activity under "PayMongo (system)". Failed and
   * Expired Orders can still become Paid; a Paid Order never moves back.
   * "duplicate" for an event applied before, "unknown-order" for one about no
   * Order of ours (both change nothing).
   */
  recordPaymentEvent(event: PaymentEvent): Promise<PaymentEventResult>;
  /**
   * The daily sweep (ticket 05): asks the payments client once more about
   * each Pending Order older than 24 hours, and records it Paid if it says
   * so, otherwise Expired; one PayMongo can't answer about stays Pending for
   * the next sweep. Gives the counts.
   */
  expireOverdueOrders(client: PaymentsClient | null): Promise<ExpirySweep>;
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
export const openReviewerPdf = impl.openReviewerPdf;
export const readReviewerPage = impl.readReviewerPage;
export const saveReaderPosition = impl.saveReaderPosition;
export const getProgress = impl.getProgress;
export const getTopicPercents = impl.getTopicPercents;
export const listNotices = impl.listNotices;
export const dismissNotice = impl.dismissNotice;
export const listRenewalReminders = impl.listRenewalReminders;
export const dismissRenewalReminder = impl.dismissRenewalReminder;
export const listOpenPrivacyRequests = impl.listOpenPrivacyRequests;
export const requestPrivacy = impl.requestPrivacy;
export const listMemberPlans = impl.listMemberPlans;
export const listExamsOnSale = impl.listExamsOnSale;
export const payForPlan = impl.payForPlan;
export const getMemberOrder = impl.getMemberOrder;
export const listMemberOrders = impl.listMemberOrders;
export const getPaymentAcknowledgement = impl.getPaymentAcknowledgement;
export const requestInvoice = impl.requestInvoice;
export const checkOrderStatus = impl.checkOrderStatus;
export const pollOrderStatus = impl.pollOrderStatus;
export const recordPaymentEvent = impl.recordPaymentEvent;
export const expireOverdueOrders = impl.expireOverdueOrders;
