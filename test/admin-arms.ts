import type { Order } from "@/lib/payments/order-ledger";
import type { OrderRefund } from "@/lib/payments/refunds";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizzes/quiz-rules";
import type { AdminService } from "@/services/admin";
import * as sampleArm from "@/services/admin.mock";
import type { DeniedSignIn, StaffActivity } from "@/services/admin.types";
import type { MemberService } from "@/services/member";
import * as memberSampleArm from "@/services/member.mock";
import type {
  AccessPass,
  AccessPassGrant,
  Card,
  CardMark,
  ContentKind,
  Question,
  Quiz,
  ReviewerPageView,
  ReviewerPdfUpload,
} from "@/services/content.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { LessonState } from "@/services/courses.types";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import type { ContentFiles, ReviewerPdfFiles } from "@/services/uploads";
import { sampleContentFiles, sampleReviewerPdfFiles } from "@/services/uploads.mock";
import type { UploadRequest } from "@/services/uploads.types";

import { DATABASE_ARM } from "./admin-database";
import { type CardImageUpload, uploadSampleCardImage } from "./card-images";
import { type ImportFiles, type ImportPaths, uploadSampleImport } from "./import-files";
import { newContent } from "./content-inputs";
import { editSampleCatalogue } from "./catalogue-seed";
import {
  type ReviewerPdfUploadOptions,
  sampleReviewerPdfFile,
  uploadSampleReviewerPdf,
} from "./reviewer-pdf-uploads";
import type { MemberRecordCounts } from "./member-records";
import { uploadSamplePhoto } from "./sample-photo";

/**
 * The Admin seam's arms, for `describe.each(ADMIN_ARMS)` (CONVENTIONS §6). Each
 * suite runs the same behaviour against every arm: the sample arm in the unit
 * project (`pnpm test`), and the database arm in the database project
 * (`pnpm test:db`), which runs these suites too when TEST_DATABASE_URL is set
 * and marks them with ADMIN_TEST_ARM=database (vitest.config.ts).
 *
 * Besides the arm itself, each entry can reset its data to the seed and read
 * back what the seam has no read for yet, such as Staff Activity.
 */
export interface AdminArm {
  name: string;
  seam: AdminService;
  /**
   * The Member seam's matching arm, for the Member App's side of a test:
   * signing in, claiming a device, agreeing, Target Exams, progress.
   */
  member: MemberService;
  /**
   * Restores the seed data, or an edited copy of it for states the seed lacks.
   * Times in it are relative to the current (possibly fake) time.
   */
  reset(edit?: (seed: CatalogueSeed) => void): Promise<void>;
  /** Deletes a Product (and its Reviews) behind the seam's back, as another Staff User might. */
  deleteProductElsewhere(id: string): Promise<void>;
  /** Deletes a Review behind the seam's back, as another Staff User might. */
  deleteReviewElsewhere(id: string): Promise<void>;
  /**
   * Deletes a Member's record behind the seam's back, as deleting their
   * account will (ticket 19). Their Privacy Requests and Orders (ticket 14)
   * stay, with no Member.
   */
  deleteMemberElsewhere(userId: string): Promise<void>;
  /**
   * Uploads a PNG through the upload seam, as the photo strip does, and gives
   * the path a save records and where the Website will load it from. With
   * `send: false` the browser never sends the file, as when an upload hasn't
   * finished.
   */
  uploadPhoto(options?: {
    send?: boolean;
    purpose?: UploadRequest["purpose"];
  }): Promise<{ path: string; publicUrl: string }>;
  staffActivity(): Promise<StaffActivity[]>;
  /**
   * Appends Staff Activity records, in order, behind the seam's back, as other
   * Staff Users' writes or PayMongo's outcomes would (ticket 15).
   */
  putStaffActivity(records: readonly StaffActivity[]): Promise<void>;
  deniedSignIns(): Promise<DeniedSignIn[]>;
  /**
   * Gives a Topic a Hidden deck or quiz, or a Draft Reviewer PDF, behind the
   * seam's back, as a later ticket's import or upload will. Gives its id.
   */
  putContent(kind: ContentKind, topicId: string): Promise<string>;
  /**
   * Uploads a card import's CSV (and zip) through the upload seam's private
   * uploads, as the import screen does (ticket 06), and gives their paths.
   */
  uploadImport(files: ImportFiles): Promise<ImportPaths>;
  /** Every deck's cards, read behind the seam's back, by deck then position. */
  cards(): Promise<Card[]>;
  /** The file the private content bucket holds at a path, or null. */
  storedFile(path: string): Promise<Uint8Array | null>;
  /** The private content bucket the arm uses, for a test to watch or break. */
  contentFiles: ContentFiles;
  /**
   * Makes every Staff Activity write fail, as a failure halfway through a
   * save would, until the function it gives is called.
   */
  breakStaffActivity(): Promise<() => Promise<void>>;
  /**
   * Uploads a card's back image through the upload seam's private uploads, as
   * the card form does (ticket 07), and gives the path its save sends. The
   * file arrives as given, whatever it is, as Storage's bucket takes it.
   */
  uploadCardImage(bytes: Uint8Array, options?: CardImageUpload): Promise<string>;
  /** Gives a Member a Card Mark, behind the seam's back, as the flashcard player will (ticket 08). */
  putCardMark(mark: CardMark): Promise<void>;
  /** Every Member's Card Marks, read behind the seam's back, by card then Member. */
  cardMarks(): Promise<CardMark[]>;
  /** Every quiz, read behind the seam's back, by id. */
  quizzes(): Promise<Quiz[]>;
  /** Every quiz's questions, removed ones too, read behind the seam's back (byQuizAndPosition). */
  questions(): Promise<Question[]>;
  /**
   * Uploads a Reviewer PDF through the upload seam, as the Reviewer PDFs
   * screen does (ticket 12), and gives the path its record claims. With
   * `send: false` the browser never sends the file.
   */
  uploadReviewerPdf(bytes: Uint8Array, options?: ReviewerPdfUploadOptions): Promise<string>;
  /** The file at a path in the private Reviewer PDFs bucket the arm uses, or null. */
  reviewerPdfFile(path: string): Promise<Uint8Array | null>;
  /** The private Reviewer PDFs bucket the arm uses, for a test to change behind the seam's back. */
  reviewerPdfFiles: ReviewerPdfFiles;
  /** Changes an uploaded Reviewer PDF's job behind the seam's back, as a stalled or odd run might leave it. */
  setReviewerPdfUpload(id: string, change: Partial<ReviewerPdfUpload>): Promise<void>;
  /**
   * Gives a Member an Access Pass, with the grants that made it, behind the
   * seam's back, as a grant (ticket 17) will.
   */
  putAccessPass(pass: AccessPass, grants?: AccessPassGrant[]): Promise<void>;
  /** Adds an Order behind the seam's back, as a Member's Pay does (Phase 4, ticket 03). */
  putOrder(order: Order): Promise<void>;
  /** Every Order, read behind the seam's back, by reference. */
  orders(): Promise<Order[]>;
  /** Every Order's PayMongo refunds, read behind the seam's back, by refund id (ticket 09). */
  orderRefunds(): Promise<OrderRefund[]>;
  /** A Member's Access Pass history for an Exam, read behind the seam's back, in order (ticket 09). */
  passHistory(userId: string, examCode: string): Promise<AccessPassGrant[]>;
  /**
   * How many records of each kind the Member App keeps for a User id, read
   * behind the seam's back (ticket 19): what deleting an account must empty.
   */
  memberRecords(userId: string): Promise<MemberRecordCounts>;
  /**
   * Sets a Lesson's state behind the seam's back, with a video to match
   * (lessonVideoFor): none for "no-video", a test video otherwise, with a
   * length once it's ready (draft or published), and no replacement.
   */
  setLessonState(id: string, state: LessonState): Promise<void>;
}

/** Pure: a Lesson's video fields to go with a state set behind the seam's back. */
export function lessonVideoFor(id: string, state: LessonState) {
  const ready = state === "draft" || state === "published";
  return {
    state,
    videoId: state === "no-video" ? null : `test-video-${id.slice(0, 8)}`,
    videoSeconds: ready ? 600 : null,
    replacementVideoId: null,
    replacementState: null,
  };
}

/** Pure: Card Marks by card, then Member. */
export const byCardAndMember = (marks: CardMark[]) =>
  [...marks].sort((a, b) => a.cardId.localeCompare(b.cardId) || a.userId.localeCompare(b.userId));

/** Pure: Reviewer PDF pages viewed by Member, then Reviewer PDF, then page. */
export const byMemberAndPage = (views: ReviewerPageView[]) =>
  [...views].sort(
    (a, b) =>
      a.userId.localeCompare(b.userId) ||
      a.reviewerPdfId.localeCompare(b.reviewerPdfId) ||
      a.page - b.page,
  );

/** Pure: Orders by reference: "AYC-10002" before "AYC-10010". */
export const byReference = (orders: Order[]) =>
  [...orders].sort(
    (a, b) => a.reference.length - b.reference.length || a.reference.localeCompare(b.reference),
  );

/** Pure: quizzes by id. */
export const byId = <T extends { id: string }>(records: T[]) =>
  [...records].sort((a, b) => a.id.localeCompare(b.id));

/** Pure: questions by quiz, then by position, with the removed ones last, oldest first. */
export const byQuizAndPosition = (questions: Question[]) =>
  [...questions].sort(
    (a, b) =>
      a.quizId.localeCompare(b.quizId) ||
      (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
      (a.removedAt ?? "").localeCompare(b.removedAt ?? "") ||
      a.id.localeCompare(b.id),
  );

/** Pure: cards by deck, then by position. */
export const byDeckAndPosition = (cards: Card[]) =>
  [...cards].sort((a, b) => a.deckId.localeCompare(b.deckId) || a.position - b.position);

export const SAMPLE_ARM: AdminArm = {
  name: "sample data",
  seam: sampleArm,
  member: memberSampleArm,
  reset: async (edit) => {
    if (edit) editSampleCatalogue(edit);
    else resetSampleStore();
  },
  deleteProductElsewhere: async (id) => {
    const { catalogue } = getSampleStore();
    catalogue.products = catalogue.products.filter((product) => product.id !== id);
    catalogue.reviews = catalogue.reviews.filter((review) => review.productId !== id);
  },
  deleteReviewElsewhere: async (id) => {
    const { catalogue } = getSampleStore();
    catalogue.reviews = catalogue.reviews.filter((review) => review.id !== id);
  },
  deleteMemberElsewhere: async (userId) => {
    const store = getSampleStore();
    store.members = store.members.filter((member) => member.userId !== userId);
    // Their Orders stay, with no account, as the database's set null leaves them (ticket 14).
    store.orders = store.orders.map((order) =>
      order.userId === userId ? { ...order, userId: null } : order,
    );
  },
  uploadPhoto: uploadSamplePhoto,
  staffActivity: async () => structuredClone(getSampleStore().staffActivity),
  putStaffActivity: async (records) => {
    const store = getSampleStore();
    store.staffActivity = [...store.staffActivity, ...structuredClone(records)];
  },
  deniedSignIns: async () => structuredClone(getSampleStore().deniedSignIns),
  putContent: async (kind, topicId) => {
    const store = getSampleStore();
    const { id, visibility, status, freePreview } = newContent(topicId);
    if (kind === "deck") store.decks = [...store.decks, { id, topicId, visibility, freePreview }];
    if (kind === "quiz") {
      store.quizzes = [
        ...store.quizzes,
        { id, topicId, visibility, freePreview, ...DEFAULT_QUIZ_SETTINGS },
      ];
    }
    if (kind === "reviewer-pdf") {
      store.reviewerPdfs = [...store.reviewerPdfs, { id, topicId, status, freePreview }];
    }
    return id;
  },
  uploadImport: uploadSampleImport,
  cards: async () => byDeckAndPosition(structuredClone(getSampleStore().cards)),
  storedFile: async (path) => getSampleStore().contentFiles[path]?.bytes ?? null,
  contentFiles: sampleContentFiles,
  uploadCardImage: uploadSampleCardImage,
  putCardMark: async (mark) => {
    const store = getSampleStore();
    store.cardMarks = [...store.cardMarks, structuredClone(mark)];
  },
  cardMarks: async () => byCardAndMember(structuredClone(getSampleStore().cardMarks)),
  quizzes: async () => byId(structuredClone(getSampleStore().quizzes)),
  questions: async () => byQuizAndPosition(structuredClone(getSampleStore().questions)),
  uploadReviewerPdf: uploadSampleReviewerPdf,
  reviewerPdfFile: sampleReviewerPdfFile,
  reviewerPdfFiles: sampleReviewerPdfFiles,
  setReviewerPdfUpload: async (id, change) => {
    const store = getSampleStore();
    const upload = store.reviewerPdfUploads[id];
    if (!upload) throw new Error(`No uploaded Reviewer PDF ${id}`);
    store.reviewerPdfUploads = { ...store.reviewerPdfUploads, [id]: { ...upload, ...change } };
  },
  putAccessPass: async (pass, grants = []) => {
    const store = getSampleStore();
    store.accessPasses = [...store.accessPasses, structuredClone(pass)];
    store.accessPassGrants = [...store.accessPassGrants, ...structuredClone(grants)];
  },
  putOrder: async (order) => {
    const store = getSampleStore();
    store.orders = [...store.orders, structuredClone(order)];
  },
  orders: async () => byReference(structuredClone(getSampleStore().orders)),
  orderRefunds: async () => byId(structuredClone(getSampleStore().orderRefunds)),
  passHistory: async (userId, examCode) =>
    structuredClone(
      getSampleStore().accessPassGrants.filter(
        (grant) => grant.userId === userId && grant.examCode === examCode,
      ),
    ),
  memberRecords: async (userId) => {
    const store = getSampleStore();
    const mine = (records: readonly { userId: string | null }[]) =>
      records.filter((record) => record.userId === userId).length;
    return {
      member: mine(store.members),
      consents: mine(store.memberConsents),
      targetExams: store.memberTargetExams[userId]?.length ?? 0,
      activeDevice: store.memberActiveDevices[userId] ? 1 : 0,
      deviceSwitches: mine(store.memberDeviceSwitches),
      accessPasses: mine(store.accessPasses),
      accessPassGrants: mine(store.accessPassGrants),
      notices: mine(store.memberNotices),
      renewalDismissals: mine(store.renewalDismissals),
      cardMarks: mine(store.cardMarks),
      studyDays: mine(store.studyDays),
      deckPositions: mine(store.deckPositions),
      quizAttempts: mine(store.quizAttempts),
      reviewerPageViews: mine(store.reviewerPageViews),
      readerPositions: mine(store.readerPositions),
      privacyRequests: mine(store.privacyRequests),
    };
  },
  setLessonState: async (id, state) => {
    const store = getSampleStore();
    store.lessons = store.lessons.map((lesson) =>
      lesson.id === id ? { ...lesson, ...lessonVideoFor(id, state) } : lesson,
    );
  },
  breakStaffActivity: async () => {
    const store = getSampleStore();
    const records = store.staffActivity;
    Object.defineProperty(store, "staffActivity", {
      configurable: true,
      get: () => records,
      set: () => {
        throw new Error("Staff Activity can't be written.");
      },
    });
    return async () => {
      Object.defineProperty(store, "staffActivity", {
        configurable: true,
        writable: true,
        value: records,
      });
    };
  },
};

export const ADMIN_ARMS: AdminArm[] =
  process.env.ADMIN_TEST_ARM === "database" ? [DATABASE_ARM] : [SAMPLE_ARM];
