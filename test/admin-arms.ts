import type { AdminService } from "@/services/admin";
import * as sampleArm from "@/services/admin.mock";
import type { DeniedSignIn, StaffActivity } from "@/services/admin.types";
import type { Card, CardMark, ContentKind } from "@/services/content.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import type { ContentFiles } from "@/services/uploads";
import { sampleContentFiles } from "@/services/uploads.mock";
import type { UploadRequest } from "@/services/uploads.types";

import { DATABASE_ARM } from "./admin-database";
import { type CardImageUpload, uploadSampleCardImage } from "./card-images";
import { type ImportFiles, type ImportPaths, uploadSampleImport } from "./card-import-files";
import { newContent } from "./content-inputs";
import { editSampleCatalogue } from "./catalogue-seed";
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
   * Restores the seed data, or an edited copy of it for states the seed lacks.
   * Times in it are relative to the current (possibly fake) time.
   */
  reset(edit?: (seed: CatalogueSeed) => void): Promise<void>;
  /** Deletes a Product (and its Reviews) behind the seam's back, as another Staff User might. */
  deleteProductElsewhere(id: string): Promise<void>;
  /** Deletes a Review behind the seam's back, as another Staff User might. */
  deleteReviewElsewhere(id: string): Promise<void>;
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
}

/** Pure: Card Marks by card, then Member. */
export const byCardAndMember = (marks: CardMark[]) =>
  [...marks].sort((a, b) => a.cardId.localeCompare(b.cardId) || a.userId.localeCompare(b.userId));

/** Pure: cards by deck, then by position. */
export const byDeckAndPosition = (cards: Card[]) =>
  [...cards].sort((a, b) => a.deckId.localeCompare(b.deckId) || a.position - b.position);

const SAMPLE_ARM: AdminArm = {
  name: "sample data",
  seam: sampleArm,
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
  uploadPhoto: uploadSamplePhoto,
  staffActivity: async () => structuredClone(getSampleStore().staffActivity),
  deniedSignIns: async () => structuredClone(getSampleStore().deniedSignIns),
  putContent: async (kind, topicId) => {
    const store = getSampleStore();
    const { id, visibility, status, freePreview } = newContent(topicId);
    if (kind === "deck") store.decks = [...store.decks, { id, topicId, visibility, freePreview }];
    if (kind === "quiz") {
      store.quizzes = [...store.quizzes, { id, topicId, visibility, freePreview }];
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
