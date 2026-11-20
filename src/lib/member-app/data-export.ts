import { manilaDate } from "@/lib/manila-time";
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
import type { TargetExamRecord } from "@/services/member.rules";
import type {
  ActiveDevice,
  ConsentRecord,
  DeviceSwitch,
  Member,
  MemberNotice,
} from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// A Member's data copy (spec, Phase 3 planning decisions → Privacy Requests in
// the Admin; story 133q), pure: everything kept about one Member, as the JSON
// file an Owner downloads from their data-copy request and emails from the
// support inbox (the app sends nothing). It holds their profile, Target Exams
// (removed ones too), consents, Access Passes with the grants behind them,
// progress records (Card Marks, Quiz Attempts, Reviewer pages viewed, Study
// Days), resume state, the device log and their in-app notices.
//
// It's built from records that may hold every Member's: each list keeps only
// the Member's own, so another Member's data can never reach the file. Each
// record drops the User id it repeats, and the file leaves out what isn't the
// Member's: the hash of their device's token, and who on the staff granted a
// pass. Each list is in time order.
// ─────────────────────────────────────────────────────────────────────────────

export const MEMBER_DATA_FORMAT = "ayc-member-data";
export const MEMBER_DATA_VERSION = 1;

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
    grants: Omit<AccessPassGrant, "userId" | "examCode" | "grantedBy">[];
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
        .map(({ examCode: _, grantedBy: __, ...grant }) => grant),
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
  };
}

/**
 * Pure: the downloaded file's name, by the Manila day it was made and the
 * start of the Member's User id. Never their email: the name travels with
 * the file.
 */
export const memberDataFilename = (userId: string, now: Date): string =>
  `${MEMBER_DATA_FORMAT}-${manilaDate(now)}-${userId.slice(0, 8)}.json`;
