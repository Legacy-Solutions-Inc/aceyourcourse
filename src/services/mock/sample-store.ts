import { AsyncLocalStorage } from "node:async_hooks";

import type {
  BetaTester,
  DeniedSignIn,
  Invite,
  RecordStamp,
  StaffActivity,
  StaffMember,
} from "@/services/admin.types";
import { type CatalogueSeed, validateCatalogueSeed } from "@/services/catalogue.schema";
import type {
  AccessPass,
  AccessPassGrant,
  Deck,
  Quiz,
  ReviewerPdf,
  Topic,
} from "@/services/content.types";
import type { TargetExamRecord } from "@/services/member.rules";
import type { ConsentRecord, DeviceSwitch, Member } from "@/services/member.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { sampleContent } from "@/services/mock/content";
import { sampleAccessPasses, sampleBetaTesters } from "@/services/mock/members";
import { sampleStaff } from "@/services/mock/staff";
import type { UploadContentType, UploadLookup, UploadRequest } from "@/services/uploads.types";

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
  purpose: UploadRequest["purpose"];
  contentType: UploadContentType;
  /** The size the browser declared, in bytes; the file sent must match it. */
  size: number;
  token: string;
  /** The file, once sent. Null until then. */
  bytes: Uint8Array | null;
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
  quizzes: Quiz[];
  reviewerPdfs: ReviewerPdf[];
  /** Every Member's Access Passes, at most one per Exam (Phase 3). */
  accessPasses: AccessPass[];
  /** The grants behind the Access Passes, oldest first (Phase 3; written from ticket 17). */
  accessPassGrants: AccessPassGrant[];
  /** The upload seam's files, by upload id. */
  uploads: Record<string, SampleUpload>;
  /**
   * What a save finds at an upload's path. Unset, it's the sample uploads'
   * (uploads.mock.ts); the Admin's database arm sets Storage's (ticket 17).
   */
  uploadAt?: UploadLookup;
}

const STORE = Symbol.for("aceyourcourse.admin.sample-store");
const holder = globalThis as typeof globalThis & { [STORE]?: SampleStore };

function createSampleStore(now: Date, seed: CatalogueSeed): SampleStore {
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
    ...sampleAccessPasses(now, catalogue),
    uploads: {},
  };
}

/** A store standing in for the sample data, while withStandInStore runs. */
const standIn = new AsyncLocalStorage<SampleStore>();

/** The sample data, made from the seed on first use (or the stand-in store, inside withStandInStore). */
export function getSampleStore(): SampleStore {
  return standIn.getStore() ?? (holder[STORE] ??= createSampleStore(new Date(), CATALOGUE_SEED));
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
 * edited copy of it (tests). Throws when that seed fails validation.
 */
export function resetSampleStore(seed: CatalogueSeed = CATALOGUE_SEED): SampleStore {
  holder[STORE] = createSampleStore(new Date(), seed);
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
