import type { AdminService } from "@/services/admin";
import * as adminSampleArm from "@/services/admin.mock";
import type { MemberService } from "@/services/member";
import * as sampleArm from "@/services/member.mock";
import type { AccessPass, CardMark, QuizAttempt, ReviewerPageView } from "@/services/content.types";
import type { ConsentRecord, DeviceSwitch, Member, PrivacyRequest } from "@/services/member.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { byCardAndMember, byMemberAndPage } from "./admin-arms";
import { sampleActor } from "./admin-inputs";
import { type CardImageUpload, uploadSampleCardImage } from "./card-images";
import { editSampleCatalogue } from "./catalogue-seed";
import { uploadSampleReviewerPdf } from "./reviewer-pdf-uploads";
import { MEMBER_DATABASE_ARM } from "./member-database";

/** Who marks a Privacy Request done behind the seam's back: the sample Owner, as they are. */
const OWNER = { email: sampleActor("owner").email, name: sampleActor("owner").name };

/**
 * The Member seam's arms, for `describe.each(MEMBER_ARMS)` (spec, Phase 3 →
 * Phase 3 seams): one behaviour suite runs against the sample arm in the unit
 * project (`pnpm test`) and the database arm in the database project
 * (`pnpm test:db`, CI), picked like the Admin's by ADMIN_TEST_ARM
 * (vitest.config.ts).
 *
 * Each entry also carries the Admin seam's matching arm, for what Owners
 * change behind the Member's back (the Beta Tester list), and reads back the
 * Member records the seam has no read for.
 */
export interface MemberArm {
  name: string;
  seam: MemberService;
  admin: AdminService;
  /**
   * Restores the sample data, or an edited copy of its catalogue for states
   * the seed lacks, timed from the current (possibly fake) time.
   */
  reset(edit?: (seed: CatalogueSeed) => void): Promise<void>;
  /** Every Member record, in the order they joined. */
  members(): Promise<Member[]>;
  /** Every Member's consent records, in the order they were recorded. */
  consents(): Promise<ConsentRecord[]>;
  /** Every Active Device record as stored, token hash and all, oldest claim first. */
  activeDevices(): Promise<StoredActiveDevice[]>;
  /** Every Member's switch log entries, in the order they were recorded. */
  deviceSwitches(): Promise<DeviceSwitch[]>;
  /** Gives a Member an Access Pass behind the seam's back, as a grant (ticket 17) will. */
  putAccessPass(pass: AccessPass): Promise<void>;
  /** Uploads a card's back image as the Admin's card form does, and gives the path its save sends. */
  uploadCardImage(bytes: Uint8Array, options?: CardImageUpload): Promise<string>;
  /** Uploads a Reviewer PDF as the Admin's Reviewer PDFs screen does, and gives the path its record claims. */
  uploadReviewerPdf(bytes: Uint8Array): Promise<string>;
  /** Every Member's Card Marks as stored, by card then Member: one row per Member and card. */
  cardMarks(): Promise<CardMark[]>;
  /** Every Member's Quiz Attempts as stored, with their answers, oldest first. */
  quizAttempts(): Promise<QuizAttempt[]>;
  /** Every Member's Reviewer PDF pages viewed as stored, by Member, Reviewer PDF and page. */
  pageViews(): Promise<ReviewerPageView[]>;
  /** Every Privacy Request as stored, open and done, oldest first; null for a deleted Member's. */
  privacyRequests(): Promise<(Omit<PrivacyRequest, "userId"> & { userId: string | null })[]>;
  /** Marks a Privacy Request done behind the seam's back, as an Owner does (ticket 19). */
  finishPrivacyRequest(id: string): Promise<void>;
}

/** An Active Device record as it is stored, for checking what is (and isn't) kept. */
export interface StoredActiveDevice {
  userId: string;
  tokenHash: string;
  deviceLabel: string;
  claimedAt: string;
}

const SAMPLE_ARM: MemberArm = {
  name: "sample data",
  seam: sampleArm,
  admin: adminSampleArm,
  reset: async (edit) => {
    if (edit) editSampleCatalogue(edit);
    else resetSampleStore();
  },
  members: async () => structuredClone(getSampleStore().members),
  consents: async () => structuredClone(getSampleStore().memberConsents),
  activeDevices: async () =>
    Object.entries(getSampleStore().memberActiveDevices)
      .map(([userId, record]) => ({ userId, ...record }))
      .sort((a, b) => a.claimedAt.localeCompare(b.claimedAt)),
  deviceSwitches: async () => structuredClone(getSampleStore().memberDeviceSwitches),
  putAccessPass: async (pass) => {
    const store = getSampleStore();
    store.accessPasses = [...store.accessPasses, structuredClone(pass)];
  },
  uploadCardImage: uploadSampleCardImage,
  uploadReviewerPdf: (bytes) => uploadSampleReviewerPdf(bytes),
  cardMarks: async () => byCardAndMember(structuredClone(getSampleStore().cardMarks)),
  quizAttempts: async () => structuredClone(getSampleStore().quizAttempts),
  pageViews: async () => byMemberAndPage(structuredClone(getSampleStore().reviewerPageViews)),
  privacyRequests: async () => structuredClone(getSampleStore().privacyRequests),
  finishPrivacyRequest: async (id) => {
    const store = getSampleStore();
    store.privacyRequests = store.privacyRequests.map((request) =>
      request.id === id
        ? { ...request, status: "done", doneAt: new Date().toISOString(), doneBy: OWNER }
        : request,
    );
  },
};

export const MEMBER_ARMS: MemberArm[] =
  process.env.ADMIN_TEST_ARM === "database" ? [MEMBER_DATABASE_ARM] : [SAMPLE_ARM];
