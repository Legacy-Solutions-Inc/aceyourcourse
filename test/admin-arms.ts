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
   * account will (ticket 19). Their Privacy Requests stay, with no Member.
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

const SAMPLE_ARM: AdminArm = {
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
  },
  uploadPhoto: uploadSamplePhoto,
  staffActivity: async () => structuredClone(getSampleStore().staffActivity),
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
