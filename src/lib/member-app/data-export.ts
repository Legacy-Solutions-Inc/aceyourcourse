import { manilaDate } from "@/lib/manila-time";
import type { OrderWithInvoice } from "@/lib/payments/invoice-requests";
import { effectiveStatus, type Order, type OrderStatus } from "@/lib/payments/order-ledger";
import { type OrderRefund, succeededRefunds } from "@/lib/payments/refunds";
import type {
  AccessPass,
  AccessPassGrant,
  CardMark,
  DeckPosition,
  QuizAttempt,
  ReaderPosition,
  ReviewerPageView,
  StudyDay,
} from "@/services/content.types";
import type { LessonProgress } from "@/services/courses.types";
import type { TargetExamRecord } from "@/services/member.rules";
import type {
  ActiveDevice,
  ConsentRecord,
  DeviceSwitch,
  Member,
  MemberNotice,
  OwnedCourse,
} from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// A Member's data copy (spec, Phase 3 planning decisions → Privacy Requests in
// the Admin; story 133q), pure: everything kept about one Member, as the JSON
// file an Owner downloads from their data-copy request and emails from the
// support inbox (the app sends nothing). It holds their profile, Target Exams
// (removed ones too), consents, Access Passes with the grants behind them,
// progress records (Card Marks, Quiz Attempts, Reviewer pages viewed, Study
// Days), resume state, the device log, their in-app notices, (version 2,
// Phase 4 ticket 14) their Orders, each with its refunds and Invoice Request,
// and (version 3, Phase 5 ticket 07) the Courses they own, each with its
// source, and their Lesson progress.
//
// A new version only adds sections, so whatever reads an older file reads a
// newer one: every section of versions 1 and 2 is still there, by the same
// name and shape. (Version 3's notices also say a Course notice's Course.)
//
// It's built from records that may hold every Member's: each list keeps only
// the Member's own, so another Member's data can never reach the file. Each
// record drops the User id it repeats, and the file leaves out what isn't the
// Member's: the hash of their device's token, and who on the staff granted a
// pass. Each list is in time order.
// ─────────────────────────────────────────────────────────────────────────────

export const MEMBER_DATA_FORMAT = "ayc-member-data";
/**
 * Version 2 (ticket 14) adds `orders`; version 3 (Phase 5, ticket 07) adds
 * `courses` and `lessonProgress`. Every section of the versions before is as
 * it was.
 */
export const MEMBER_DATA_VERSION = 3;

/** What a data copy is built from: the Member, their own one-of records, and records that may hold every Member's. */
export interface MemberDataSource {
  member: Member;
  /** The Exam they last selected, or null. */
  selectedExamCode: string | null;
  /** Their own Target Exam records, removed ones too. */
  targetExams: TargetExamRecord[];
  /** Their Active Device, or null. */
  activeDevice: ActiveDevice | null;
  consents: ConsentRecord[];
  accessPasses: AccessPass[];
  accessPassGrants: AccessPassGrant[];
  cardMarks: CardMark[];
  quizAttempts: QuizAttempt[];
  reviewerPageViews: ReviewerPageView[];
  studyDays: StudyDay[];
  deckPositions: DeckPosition[];
  readerPositions: ReaderPosition[];
  deviceSwitches: DeviceSwitch[];
  notices: MemberNotice[];
  /** Orders, with their Invoice Requests and PayMongo refunds (ticket 14). */
  orders: (OrderWithInvoice & { refunds: OrderRefund[] })[];
  /** Course Ownerships, each with its Course's title and Exam and its source (Phase 5, ticket 07). */
  courseOwnerships: (OwnedCourse & { userId: string })[];
  /** Lesson progress (Phase 5, ticket 07). */
  lessonProgress: LessonProgress[];
}

/**
 * One of the Member's Orders, as the file holds it (ticket 14): what they
 * bought and paid, as at Pay, its state as every screen shows it, the
 * refunds that went through, and their Invoice Request.
 */
export interface ExportedOrder {
  reference: string;
  examCode: string;
  planName: string;
  days: Order["days"];
  priceCentavos: number;
  method: Order["method"];
  /** A Pending Order past its 24 hours is Expired. */
  status: OrderStatus;
  /** False for a Test Order. */
  livemode: boolean;
  createdAt: string;
  paidAt: string | null;
  /** The name and email given at Pay. */
  buyer: { name: string | null; email: string };
  /** PayMongo's reference, as the Payment Acknowledgement gives it: the payment's id, or the checkout's. */
  payMongoReference: string | null;
  refunds: { amountCentavos: number; refundedAt: string }[];
  invoiceRequest: {
    name: string;
    address: string;
    tin: string | null;
    requestedAt: string;
    sentAt: string | null;
  } | null;
}

/** A record without the User id every record in the file would repeat. */
type Own<T> = Omit<T, "userId">;

/** The data copy, as the downloaded JSON file holds it. */
export interface MemberDataExport {
  format: typeof MEMBER_DATA_FORMAT;
  version: typeof MEMBER_DATA_VERSION;
  /** ISO time the file was made. */
  exportedAt: string;
  profile: Member & { selectedExamCode: string | null };
  targetExams: TargetExamRecord[];
  consents: Own<ConsentRecord>[];
  accessPasses: (Own<AccessPass> & {
    // The Orders are their own section (ticket 14), so a paid row's Order id stays out.
    grants: Omit<AccessPassGrant, "userId" | "examCode" | "grantedBy" | "orderId">[];
  })[];
  cardMarks: Own<CardMark>[];
  quizAttempts: Own<QuizAttempt>[];
  reviewerPagesViewed: Own<ReviewerPageView>[];
  /** The Asia/Manila dates they studied, YYYY-MM-DD. */
  studyDays: string[];
  /** Where they left each deck and each Reviewer PDF. */
  resume: { decks: Own<DeckPosition>[]; reviewerPdfs: Own<ReaderPosition>[] };
  /** Their Active Device and every claim, the first one too. */
  devices: { activeDevice: ActiveDevice | null; switches: Own<DeviceSwitch>[] };
  notices: Own<MemberNotice>[];
  orders: ExportedOrder[];
  /** The Courses they own, oldest first: the Paid Order's reference, or null when given by Ace Your Course. */
  courses: OwnedCourse[];
  /** Where they are in each Lesson they've watched, oldest watched first. */
  lessonProgress: Own<LessonProgress>[];
}

/** Pure: the records that are the Member's, oldest first by `at`, without their User id. */
function own<T extends { userId: string }>(
  records: readonly T[],
  userId: string,
  at: (record: T) => string,
): Own<T>[] {
  return records
    .filter((record) => record.userId === userId)
    .sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0))
    .map(({ userId: _, ...record }) => record);
}

/** Pure: one Order as the file holds it at `now`. */
function exportedOrder(
  { order, invoice, refunds }: MemberDataSource["orders"][number],
  now: Date,
): ExportedOrder {
  return {
    reference: order.reference,
    examCode: order.examCode,
    planName: order.planName,
    days: order.days,
    priceCentavos: order.priceCentavos,
    method: order.method,
    status: effectiveStatus(order, now),
    livemode: order.livemode,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    buyer: { name: order.buyerName, email: order.buyerEmail },
    payMongoReference: order.paymentId ?? order.checkoutId,
    // A refund that went through always has its time (order_refunds' check).
    refunds: succeededRefunds(refunds).flatMap(({ amountCentavos, refundedAt }) =>
      refundedAt ? [{ amountCentavos, refundedAt }] : [],
    ),
    invoiceRequest: invoice && {
      name: invoice.name,
      address: invoice.address,
      tin: invoice.tin,
      requestedAt: invoice.requestedAt,
      sentAt: invoice.sentAt,
    },
  };
}

/** Pure: a Member's data copy, made at `now`, from records that may hold every Member's. */
export function buildMemberDataExport(source: MemberDataSource, now: Date): MemberDataExport {
  const { member, activeDevice } = source;
  const { userId } = member;
  const grants = own(source.accessPassGrants, userId, (grant) => grant.grantedAt);
  return {
    format: MEMBER_DATA_FORMAT,
    version: MEMBER_DATA_VERSION,
    exportedAt: now.toISOString(),
    profile: {
      userId,
      email: member.email,
      name: member.name,
      joinedAt: member.joinedAt,
      selectedExamCode: source.selectedExamCode,
    },
    targetExams: structuredClone(source.targetExams),
    consents: own(source.consents, userId, (consent) => consent.agreedAt),
    accessPasses: own(source.accessPasses, userId, (pass) => pass.examCode).map((pass) => ({
      ...pass,
      grants: grants
        .filter((grant) => grant.examCode === pass.examCode)
        .map(({ examCode: _, grantedBy: __, orderId: ___, ...grant }) => grant),
    })),
    cardMarks: own(source.cardMarks, userId, (mark) => `${mark.markedAt} ${mark.cardId}`),
    quizAttempts: structuredClone(own(source.quizAttempts, userId, (a) => a.submittedAt)),
    reviewerPagesViewed: own(
      source.reviewerPageViews,
      userId,
      (view) => `${view.viewedAt} ${view.reviewerPdfId} ${view.page}`,
    ),
    studyDays: own(source.studyDays, userId, (day) => day.day).map(({ day }) => day),
    resume: {
      decks: own(source.deckPositions, userId, (position) => position.savedAt),
      reviewerPdfs: own(source.readerPositions, userId, (position) => position.savedAt),
    },
    devices: {
      activeDevice: activeDevice
        ? { deviceLabel: activeDevice.deviceLabel, claimedAt: activeDevice.claimedAt }
        : null,
      switches: own(source.deviceSwitches, userId, (claim) => claim.switchedAt),
    },
    notices: own(source.notices, userId, (notice) => notice.createdAt),
    orders: source.orders
      .filter(({ order }) => order.userId === userId)
      .sort((a, b) => ordered(a.order, b.order))
      .map((held) => exportedOrder(held, now)),
    courses: own(source.courseOwnerships, userId, (owned) => `${owned.since} ${owned.courseId}`),
    lessonProgress: own(
      source.lessonProgress,
      userId,
      (progress) => `${progress.watchedAt} ${progress.lessonId}`,
    ),
  };
}

/** Pure: oldest Order first; Orders made together by reference. */
const ordered = (a: Order, b: Order) =>
  a.createdAt.localeCompare(b.createdAt) || a.reference.localeCompare(b.reference);

/**
 * Pure: the downloaded file's name, by the Manila day it was made and the
 * start of the Member's User id. Never their email: the name travels with
 * the file.
 */
export const memberDataFilename = (userId: string, now: Date): string =>
  `${MEMBER_DATA_FORMAT}-${manilaDate(now)}-${userId.slice(0, 8)}.json`;
