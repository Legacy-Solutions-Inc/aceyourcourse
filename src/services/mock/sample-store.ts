import { AsyncLocalStorage } from "node:async_hooks";

import type {
  AdminPlan,
  BetaTester,
  DeniedSignIn,
  Invite,
  RecordStamp,
  StaffActivity,
  StaffMember,
} from "@/services/admin.types";
import { type CatalogueSeed, validateCatalogueSeed } from "@/services/catalogue.schema";
import type { CardImageType } from "@/lib/cards/card-rules";
import { FIRST_REFERENCE_NUMBER, type Order } from "@/lib/payments/order-ledger";
import type {
  AccessPass,
  AccessPassGrant,
  Card,
  CardMark,
  Deck,
  DeckPosition,
  Question,
  Quiz,
  QuizAttempt,
  ReaderPosition,
  ReviewerPageView,
  ReviewerPdf,
  ReviewerPdfUpload,
  StudyDay,
  Topic,
} from "@/services/content.types";
import type { TargetExamRecord } from "@/services/member.rules";
import type {
  ConsentRecord,
  DeviceSwitch,
  Member,
  MemberNotice,
  PrivacyRequest,
} from "@/services/member.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { sampleContent } from "@/services/mock/content";
import { sampleAccessPasses, sampleBetaTesters } from "@/services/mock/members";
import { sampleOrders } from "@/services/mock/orders";
import { samplePlans } from "@/services/mock/plans";
import { sampleStaff } from "@/services/mock/staff";
import type {
  ContentUploadPurpose,
  ContentUploadType,
  UploadContentType,
  UploadLookup,
  UploadRequest,
} from "@/services/uploads.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin's Stage A sample data (CONVENTIONS §3): one editable in-memory copy,
// held by the dev server. It lives on globalThis, so every route module and
// every hot reload share it, and a server restart starts it again from the
// seed. The Catalogue seam's mock arm and the Admin seam's sample arm read it,
// so an Admin save shows on the Website.
//
// Vitest gotcha: globalThis survives vi.resetModules(), so tests call
// resetSampleStore(), with an edited seed when they need one, rather than
// reloading modules.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One upload in the sample arm of the upload seam (uploads.mock.ts): its
 * one-time URL's token, and the file once the browser has sent it. Uploads no
 * save records stay until the next reset (spec: orphans are fine in Stage A).
 */
export interface SampleUpload {
  id: string;
  /**
   * A public catalogue image, or a private file the route never serves: an
   * import's file (ticket 06), a card image (ticket 07) or a Reviewer PDF
   * (ticket 12).
   */
  purpose: UploadRequest["purpose"] | ContentUploadPurpose | "reviewer-pdf";
  contentType: UploadContentType | ContentUploadType | "application/pdf";
  /** The size the browser declared, in bytes; the file sent must match it. */
  size: number;
  token: string;
  /** The file, once sent. Null until then. */
  bytes: Uint8Array | null;
}

/** A file in the sample data's private content bucket: a card's back image (ticket 06). */
export interface SampleContentFile {
  contentType: CardImageType;
  bytes: Uint8Array;
}

/** A signed URL handed out for a card image in the sample data's private bucket (ticket 08). */
export interface SignedSampleFile {
  path: string;
  /** ISO time the URL stops working. */
  expiresAt: string;
}

/** A Privacy Request as the sample data keeps it (tickets 18 and 19), as the database row does. */
export interface SamplePrivacyRequest extends Omit<PrivacyRequest, "userId"> {
  /** The Member who asked, or null once their account is deleted. */
  userId: string | null;
  /** ISO time an Owner marked it done, and who, as they were then; null while open. */
  doneAt: string | null;
  doneBy: { email: string; name: string } | null;
  /** The User id a deletion removed the Member data of, or null before one has. */
  deletedUserId: string | null;
}

/** A Member's Active Device record in the sample data. */
export interface SampleActiveDevice {
  tokenHash: string;
  deviceLabel: string;
  /** ISO time it was claimed. */
  claimedAt: string;
}

export interface SampleStore {
  /** Changes on boot and on every reset, so caches can't outlive the data. */
  generation: string;
  /** When the data was made. The sample Invites' times are relative to it. */
  bootedAt: string;
  /** The Website's catalogue: a deep copy of the seed, edited by Admin saves. */
  catalogue: CatalogueSeed;
  /** Each saved record's stamp, by record key. See stampOf. */
  stamps: Record<string, RecordStamp>;
  staff: StaffMember[];
  invites: Invite[];
  deniedSignIns: DeniedSignIn[];
  staffActivity: StaffActivity[];
  /** The Beta Tester list, in the order they were added (Phase 3). */
  betaTesters: BetaTester[];
  /** The Members: everyone who has passed the Member App gate (Phase 3). */
  members: Member[];
  /** Every Member's agreements to the Terms and Privacy Policy, oldest first (Phase 3). */
  memberConsents: ConsentRecord[];
  /** Each Member's Target Exams, removed ones too, in the order first added, by User id (Phase 3). */
  memberTargetExams: Record<string, TargetExamRecord[]>;
  /** The Exam each Member last selected, by User id (Phase 3). */
  selectedExams: Record<string, string | null>;
  /**
   * Each Member's Active Device, by User id (Phase 3): the hash of the token
   * the device holds, never the token, with its label and claim time.
   */
  memberActiveDevices: Record<string, SampleActiveDevice>;
  /** Every Member's Active Device claims, oldest first (Phase 3). */
  memberDeviceSwitches: DeviceSwitch[];
  /** The Member App's Topics, each in its Subject's order (Phase 3). */
  topics: Topic[];
  /** Each Topic's deck, quiz and Reviewer PDF, where it has one (Phase 3). */
  decks: Deck[];
  /** Each deck's cards (ticket 06), in no particular order: each has its position. */
  cards: Card[];
  /** Every Member's Card Marks, at most one per Member and card (ticket 07; written from ticket 08). */
  cardMarks: CardMark[];
  /** Every Member's Study Days, at most one per Member and Manila date (ticket 08). */
  studyDays: StudyDay[];
  /** Where each Member left each deck, at most one per Member and deck (ticket 08). */
  deckPositions: DeckPosition[];
  /** The Reviewer PDF pages each Member viewed, at most one per Member, Reviewer PDF and page (ticket 14). */
  reviewerPageViews: ReviewerPageView[];
  /** Where each Member left each Reviewer PDF, at most one per Member and Reviewer PDF (ticket 14). */
  readerPositions: ReaderPosition[];
  quizzes: Quiz[];
  /** Each quiz's questions (ticket 09), removed ones too, in no particular order: each has its position. */
  questions: Question[];
  /** Every Member's Quiz Attempts with their answers, in the order submitted (ticket 11). */
  quizAttempts: QuizAttempt[];
  reviewerPdfs: ReviewerPdf[];
  /** Each uploaded Reviewer PDF's file and job, by its id (ticket 12). */
  reviewerPdfUploads: Record<string, ReviewerPdfUpload>;
  /** The private Reviewer PDFs bucket's files, by path (ticket 12): originals and page images. */
  reviewerPdfFiles: Record<string, Uint8Array>;
  /** Every Member's Access Passes, at most one per Exam (Phase 3). */
  accessPasses: AccessPass[];
  /** The grants behind the Access Passes, oldest first (Phase 3; written from ticket 17). */
  accessPassGrants: AccessPassGrant[];
  /** Every Member's in-app notices, in the order made (ticket 17): grants, extensions and ends. */
  memberNotices: MemberNotice[];
  /** Every Member's Privacy Requests, open and done, in the order asked (ticket 18). */
  privacyRequests: SamplePrivacyRequest[];
  /** The Plans for sale in the Member App, each with its last save (Phase 4, ticket 01). */
  plans: AdminPlan[];
  /** Every Order, in the order made (Phase 4, ticket 03). */
  orders: Order[];
  /** The number the next Order's reference carries: "AYC-10001" first, like order_reference_seq. */
  nextOrderNumber: number;
  /** Each Order's internal note, which only Staff see, by Order id (ticket 07). */
  orderNotes: Record<string, string>;
  /** When each Order's status was last asked of the payments client, by Order id (ticket 04's backup). */
  orderStatusCheckedAt: Record<string, string>;
  /** The PayMongo webhook events already applied, in the order received (ticket 05). */
  paymentEvents: { eventId: string; type: string; orderId: string | null; receivedAt: string }[];
  /** The upload seam's files, by upload id. */
  uploads: Record<string, SampleUpload>;
  /** The private content bucket's files, by path (ticket 06): card back images. */
  contentFiles: Record<string, SampleContentFile>;
  /**
   * The signed URLs handed out for the private bucket's card images, by their
   * token (ticket 08): the file's path, and when the URL stops working.
   */
  signedFiles: Record<string, SignedSampleFile>;
  /**
   * What a save finds at an upload's path. Unset, it's the sample uploads'
   * (uploads.mock.ts); the Admin's database arm sets Storage's (ticket 17).
   */
  uploadAt?: UploadLookup;
}

const STORE = Symbol.for("aceyourcourse.admin.sample-store");
const holder = globalThis as typeof globalThis & { [STORE]?: SampleStore };

/** How the sample data starts. */
export interface SampleStoreOptions {
  /**
   * With the sample Orders (ticket 07): the dev server's data and the e2e
   * specs' reset have them; unit tests start without, unless they ask.
   */
  sampleOrders?: boolean;
}

function createSampleStore(
  now: Date,
  seed: CatalogueSeed,
  { sampleOrders: withOrders = false }: SampleStoreOptions = {},
): SampleStore {
  const validation = validateCatalogueSeed(seed);
  if (!validation.success) {
    throw new Error(`Invalid catalogue seed — ${validation.errors.join("; ")}`);
  }
  const catalogue = structuredClone(validation.data);
  return {
    generation: crypto.randomUUID(),
    bootedAt: now.toISOString(),
    catalogue,
    stamps: {},
    ...sampleStaff(now),
    deniedSignIns: [],
    staffActivity: [],
    betaTesters: sampleBetaTesters(now),
    members: [],
    memberConsents: [],
    memberTargetExams: {},
    selectedExams: {},
    memberActiveDevices: {},
    memberDeviceSwitches: [],
    ...sampleContent(catalogue),
    cards: [],
    cardMarks: [],
    questions: [],
    quizAttempts: [],
    studyDays: [],
    deckPositions: [],
    reviewerPageViews: [],
    readerPositions: [],
    ...sampleAccessPasses(now, catalogue),
    memberNotices: [],
    privacyRequests: [],
    plans: samplePlans(catalogue).map((plan) => ({
      ...plan,
      stamp: { savedAt: now.toISOString(), savedBy: null },
    })),
    ...(withOrders
      ? sampleOrders(now, catalogue)
      : { orders: [], nextOrderNumber: FIRST_REFERENCE_NUMBER }),
    orderNotes: {},
    orderStatusCheckedAt: {},
    paymentEvents: [],
    reviewerPdfUploads: {},
    reviewerPdfFiles: {},
    uploads: {},
    contentFiles: {},
    signedFiles: {},
  };
}

/** A store standing in for the sample data, while withStandInStore runs. */
const standIn = new AsyncLocalStorage<SampleStore>();

/**
 * The sample data, made from the seed on first use, with the sample Orders as
 * the dev server shows them (or the stand-in store, inside withStandInStore).
 */
export function getSampleStore(): SampleStore {
  return (
    standIn.getStore() ??
    (holder[STORE] ??= createSampleStore(new Date(), CATALOGUE_SEED, { sampleOrders: true }))
  );
}

/**
 * Runs `work` with `store` standing in for the sample data: every
 * getSampleStore() inside it, however deep, gets `store`, and the sample data
 * itself is left alone. The Admin seam's database arm (admin.db.ts) loads a
 * store from Postgres and runs the sample arm's areas over it, so both arms
 * apply the same rules; it then writes back what they changed.
 */
export function withStandInStore<T>(store: SampleStore, work: () => Promise<T>): Promise<T> {
  return standIn.run(store, work);
}

/**
 * Starts the sample data again, timed from now: from the seed, or from an
 * edited copy of it (tests). Without the sample Orders unless asked for: the
 * dev reset asks (restoreSampleData). Throws when that seed fails validation.
 */
export function resetSampleStore(
  seed: CatalogueSeed = CATALOGUE_SEED,
  options: SampleStoreOptions = {},
): SampleStore {
  holder[STORE] = createSampleStore(new Date(), seed, options);
  return holder[STORE];
}

/**
 * A record's last-saved stamp. A record nobody has saved since the data was
 * made carries the time it was made, saved by nobody.
 */
export function stampOf(store: SampleStore, record: string): RecordStamp {
  return store.stamps[record] ?? { savedAt: store.bootedAt, savedBy: null };
}

/**
 * Pure: the stamp for a save made now. Each save's time is later than the one
 * before it, even within the same millisecond, so the conflict check, which
 * compares times, can never mistake a newer save for the one an editor opened.
 */
export function nextStamp(previous: RecordStamp, savedBy: string, now: Date): RecordStamp {
  const after = new Date(previous.savedAt).getTime() + 1;
  return { savedAt: new Date(Math.max(now.getTime(), after)).toISOString(), savedBy };
}
