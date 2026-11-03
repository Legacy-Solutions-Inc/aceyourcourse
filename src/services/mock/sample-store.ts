import { AsyncLocalStorage } from "node:async_hooks";

import type {
  DeniedSignIn,
  Invite,
  RecordStamp,
  StaffActivity,
  StaffMember,
} from "@/services/admin.types";
import { type CatalogueSeed, validateCatalogueSeed } from "@/services/catalogue.schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { sampleStaff } from "@/services/mock/staff";
import type { UploadContentType, UploadRequest } from "@/services/uploads.types";

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
  /** The upload seam's files, by upload id. */
  uploads: Record<string, SampleUpload>;
}

const STORE = Symbol.for("aceyourcourse.admin.sample-store");
const holder = globalThis as typeof globalThis & { [STORE]?: SampleStore };

function createSampleStore(now: Date, seed: CatalogueSeed): SampleStore {
  const validation = validateCatalogueSeed(seed);
  if (!validation.success) {
    throw new Error(`Invalid catalogue seed — ${validation.errors.join("; ")}`);
  }
  return {
    generation: crypto.randomUUID(),
    bootedAt: now.toISOString(),
    catalogue: structuredClone(validation.data),
    stamps: {},
    ...sampleStaff(now),
    deniedSignIns: [],
    staffActivity: [],
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
