import "server-only";

import { and, asc, desc, eq, getTableColumns, inArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError, postgresErrorCode } from "@/lib/db/errors";
import { diffRows } from "@/lib/db/row-diff";
import * as schema from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/supabase/admin";
import type { AdminService } from "@/services/admin";
import { staffEmailSchema } from "@/services/admin.schema";
import {
  deniedSignInFromRow,
  deniedSignInToRow,
  SEEDED_RECORD,
  staffActivityToRow,
  staffFromRows,
  type StaffRow,
  staffToRows,
  stampsFromRows,
  stampsToRows,
} from "@/services/admin.rows";
import type {
  AdminResult,
  DeniedSignIn,
  Invite,
  RecordStamp,
  StaffMember,
} from "@/services/admin.types";
import * as sampleArm from "@/services/admin.mock";
import { type CatalogueRows, catalogueFromRows, catalogueToRows } from "@/services/catalogue.rows";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { ALREADY_ON_LIST } from "@/services/mock/admin/staff";
import { getSampleStore, type SampleStore, withStandInStore } from "@/services/mock/sample-store";
import { imagesRemoved, storageArm, uploadPathsIn } from "@/services/uploads.storage";
import type { UploadLookup } from "@/services/uploads.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam on Postgres (ticket 15), selected by src/services/admin.ts
// when DATABASE_URL is set. It applies the sample arm's own rules: each call
// runs in one transaction, which
//   1. takes the write lock of each part it loads, for a write, so writes to
//      the same part run one at a time,
//   2. loads what the call needs (the catalogue and its save stamps, or the
//      staff list) into a store shaped like the sample data,
//   3. runs the sample arm's area code over that store (withStandInStore), so
//      the role check, validation, conflict check and rules are the same code
//      in both arms, and
//   4. writes back only the rows the call changed, then its Staff Activity.
// A failure at any step rolls back every row, Staff Activity included. The
// conflict check runs twice: against the stamp the call loaded, and again in
// the database, where a stamp is only updated if it still holds that value.
// Drizzle bypasses RLS, so authorisation is the seam's role check and the
// Staff Guard (coding standards §3).
//
// With Storage (ticket 17), a catalogue write first asks Storage which of the
// upload paths it sends have their file, before its transaction opens, so the
// save resolves them as the sample arm resolves its own uploads. Once the
// transaction commits, the files of the images the save stopped using are
// deleted: removed photos, a deleted Product's photos, a replaced share
// image. A failed delete is logged, and the save still succeeds.
// ─────────────────────────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** What a call reads: the catalogue with its save stamps, and the staff list. */
type Part = "catalogue" | "staff";

/**
 * Each part's write lock: writes that change the same part run one at a time,
 * so a write's checks see every write before it. The Staff Guard's sign-in
 * check (a staff write) never waits for a catalogue save.
 */
const writeLock = (part: Part) =>
  sql`select pg_advisory_xact_lock(hashtext(${`aceyourcourse:admin:${part}`}))`;

/** Postgres's SQLSTATE for a unique key refusing a row. */
const UNIQUE_VIOLATION = "23505";

/** A stamp changed in the database after the call read it. */
class StaleStampError extends Error {
  constructor(readonly record: string) {
    super(`The stamp of "${record}" changed while saving.`);
  }
}

// ── Loading ─────────────────────────────────────────────────────────────────

async function readCatalogueRows(tx: Transaction): Promise<CatalogueRows> {
  return {
    exams: await tx.select().from(schema.exams),
    subjects: await tx.select().from(schema.subjects),
    products: await tx.select().from(schema.products),
    productSubjects: await tx.select().from(schema.productSubjects),
    productVariations: await tx.select().from(schema.productVariations),
    productPhotos: await tx.select().from(schema.productPhotos),
    productListings: await tx.select().from(schema.productListings),
    reviews: await tx.select().from(schema.reviews),
    faqs: await tx.select().from(schema.faqs),
    examPages: await tx.select().from(schema.examPages),
    sitePages: await tx.select().from(schema.sitePages),
    websiteSettings: await tx.select().from(schema.websiteSettings),
    announcementMessages: await tx.select().from(schema.announcementMessages),
    promoBanner: await tx.select().from(schema.promoBanner),
  };
}

/** What a call loaded: the rows as they were, and the store the sample arm's code ran over. */
interface Loaded {
  store: SampleStore;
  catalogue?: { rows: CatalogueRows; value: CatalogueSeed };
  stamps?: Record<string, RecordStamp>;
  staff?: { rows: StaffRow[]; staff: StaffMember[]; invites: Invite[] };
}

function notLoaded(part: string): never {
  throw new Error(`The Admin's database arm didn't load ${part} for this call.`);
}

/**
 * The store the sample arm's code runs over: the parts loaded, empty Staff
 * Activity and denied sign-ins (the call's own are appended to them), and
 * Storage's uploads when there's a lookup for them. Without Storage (database
 * tests with no secret key) the sample data's uploads stand in. A part the
 * call didn't load throws when read, rather than reading as empty and being
 * saved.
 */
async function load(
  tx: Transaction,
  parts: readonly Part[],
  uploadAt: UploadLookup | undefined,
): Promise<Loaded> {
  const sample = getSampleStore();
  const loaded: Omit<Loaded, "store"> = {};
  let bootedAt = sample.bootedAt;

  if (parts.includes("catalogue")) {
    const rows = await readCatalogueRows(tx);
    loaded.catalogue = { rows, value: catalogueFromRows(rows) };
    const stamps = stampsFromRows(await tx.select().from(schema.recordStamps));
    loaded.stamps = stamps.stamps;
    bootedAt = stamps.seededAt;
  }
  if (parts.includes("staff")) {
    const rows = await tx.select().from(schema.staff);
    loaded.staff = { rows, ...staffFromRows(rows) };
  }

  let catalogue = loaded.catalogue?.value;
  let stamps = loaded.stamps;
  let staff = loaded.staff?.staff;
  let invites = loaded.staff?.invites;
  const store: SampleStore = {
    generation: sample.generation,
    bootedAt,
    get catalogue() {
      return catalogue ?? notLoaded("the catalogue");
    },
    set catalogue(value) {
      catalogue = value;
    },
    get stamps() {
      return stamps ?? notLoaded("the save stamps");
    },
    set stamps(value) {
      stamps = value;
    },
    get staff() {
      return staff ?? notLoaded("the staff list");
    },
    set staff(value) {
      staff = value;
    },
    get invites() {
      return invites ?? notLoaded("the staff list");
    },
    set invites(value) {
      invites = value;
    },
    deniedSignIns: [],
    staffActivity: [],
    // Read only: a rollback couldn't undo a change to the sample data's uploads.
    get uploads() {
      return sample.uploads;
    },
    ...(uploadAt ? { uploadAt } : {}),
  };
  return { store, ...loaded };
}

// ── Saving ──────────────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>;

/** A table the database arm writes rows to, and the properties of its primary key. */
interface Synced {
  table: PgTable;
  key: readonly string[];
}

/** Every Catalogue table, parents before children (as the seed writes them), with its key. */
const CATALOGUE_TABLES: readonly (Synced & { rows: keyof CatalogueRows })[] = [
  { rows: "exams", table: schema.exams, key: ["code"] },
  { rows: "subjects", table: schema.subjects, key: ["examCode", "code"] },
  { rows: "products", table: schema.products, key: ["id"] },
  { rows: "productSubjects", table: schema.productSubjects, key: ["productId", "subjectCode"] },
  { rows: "productVariations", table: schema.productVariations, key: ["productId", "position"] },
  { rows: "productPhotos", table: schema.productPhotos, key: ["productId", "position"] },
  { rows: "productListings", table: schema.productListings, key: ["productId", "marketplace"] },
  { rows: "reviews", table: schema.reviews, key: ["id"] },
  { rows: "faqs", table: schema.faqs, key: ["id"] },
  { rows: "examPages", table: schema.examPages, key: ["examCode"] },
  { rows: "sitePages", table: schema.sitePages, key: ["page"] },
  { rows: "websiteSettings", table: schema.websiteSettings, key: ["id"] },
  { rows: "announcementMessages", table: schema.announcementMessages, key: ["position"] },
  { rows: "promoBanner", table: schema.promoBanner, key: ["id"] },
];

const STAFF_TABLE: Synced = { table: schema.staff, key: ["email"] };

const keyOf =
  ({ key }: Synced) =>
  (row: AnyRow): string =>
    JSON.stringify(key.map((property) => row[property]));

/** The condition that picks `row` out of its table by its primary key. */
function byKey({ table, key }: Synced, row: AnyRow): SQL | undefined {
  const columns = getTableColumns(table);
  return and(
    ...key.map((property) => {
      const column = columns[property];
      if (!column) throw new Error(`No column "${property}" in the table.`);
      return eq(column, row[property]);
    }),
  );
}

/**
 * Writes the difference between each table's rows before and after. Deletes
 * run first, children before parents, so a cascade or a cleared reference
 * never meets a row the write removes; then updates and inserts, parents
 * before children.
 */
async function syncTables(
  tx: Transaction,
  changes: readonly { synced: Synced; before: readonly AnyRow[]; after: readonly AnyRow[] }[],
): Promise<void> {
  const diffs = changes.map(({ synced, before, after }) => ({
    synced,
    diff: diffRows(before, after, keyOf(synced)),
  }));
  for (const { synced, diff } of [...diffs].reverse()) {
    for (const row of diff.deleted) await tx.delete(synced.table).where(byKey(synced, row));
  }
  for (const { synced, diff } of diffs) {
    for (const row of diff.updated) {
      await tx.update(synced.table).set(row).where(byKey(synced, row));
    }
    if (diff.inserted.length) await tx.insert(synced.table).values(diff.inserted);
  }
}

/**
 * Saves the stamps the call changed. Each one is updated only where it still
 * holds the value the call read (the conflict check, in the database), and a
 * new one only if no other save made it first.
 */
async function saveStamps(
  tx: Transaction,
  before: Record<string, RecordStamp>,
  after: Record<string, RecordStamp>,
): Promise<void> {
  const { deleted, inserted, updated } = diffRows(
    stampsToRows(before),
    stampsToRows(after),
    (row) => String(row.record),
  );
  const { recordStamps } = schema;
  for (const row of deleted)
    await tx.delete(recordStamps).where(eq(recordStamps.record, row.record));
  for (const row of updated) {
    const previous = before[row.record];
    if (!previous) throw new StaleStampError(row.record);
    const saved = await tx
      .update(recordStamps)
      .set(row)
      .where(
        and(
          eq(recordStamps.record, row.record),
          eq(recordStamps.updatedAt, new Date(previous.savedAt)),
        ),
      )
      .returning({ record: recordStamps.record });
    if (saved.length !== 1) throw new StaleStampError(row.record);
  }
  if (inserted.length) {
    const saved = await tx
      .insert(recordStamps)
      .values(inserted)
      .onConflictDoNothing()
      .returning({ record: recordStamps.record });
    const missing = inserted.find((row) => !saved.some((s) => s.record === row.record));
    if (missing) throw new StaleStampError(missing.record);
  }
}

/** Whether the call changed each part of what it loaded. */
function changes({ store, ...loaded }: Loaded) {
  return {
    catalogue: loaded.catalogue !== undefined && store.catalogue !== loaded.catalogue.value,
    stamps: loaded.stamps !== undefined && store.stamps !== loaded.stamps,
    staff:
      loaded.staff !== undefined &&
      (store.staff !== loaded.staff.staff || store.invites !== loaded.staff.invites),
    deniedSignIns: store.deniedSignIns.length > 0,
    staffActivity: store.staffActivity.length > 0,
  };
}

/** Writes back what the call changed, Staff Activity last. */
async function save(tx: Transaction, loaded: Loaded): Promise<void> {
  const { store } = loaded;
  const changed = changes(loaded);
  if (changed.catalogue && loaded.catalogue) {
    const before = loaded.catalogue.rows;
    const after = catalogueToRows(store.catalogue);
    await syncTables(
      tx,
      CATALOGUE_TABLES.map((synced) => ({
        synced,
        before: before[synced.rows],
        after: after[synced.rows],
      })),
    );
  }
  if (changed.staff && loaded.staff) {
    await syncTables(tx, [
      { synced: STAFF_TABLE, before: loaded.staff.rows, after: staffToRows(store) },
    ]);
  }
  if (changed.stamps && loaded.stamps) await saveStamps(tx, loaded.stamps, store.stamps);
  if (changed.deniedSignIns) {
    await tx.insert(schema.deniedSignIns).values(store.deniedSignIns.map(deniedSignInToRow));
  }
  if (changed.staffActivity) {
    await tx.insert(schema.staffActivity).values(store.staffActivity.map(staffActivityToRow));
  }
}

// ── Running a call ──────────────────────────────────────────────────────────

/** The images a write stopped using, for Storage's clean-up once it commits. */
function imagesRemovedBy(loaded: Loaded): string[] {
  if (!changes(loaded).catalogue || !loaded.catalogue) return [];
  return imagesRemoved(loaded.catalogue.value, loaded.store.catalogue);
}

/**
 * Runs `work` in one transaction, through the steps at the top of this file.
 * `args` are the call's arguments, where a catalogue write's upload paths are.
 */
async function onDatabase<T>(
  parts: readonly Part[],
  mode: "read" | "write",
  work: () => Promise<T>,
  args: readonly unknown[] = [],
): Promise<T> {
  const storage = isStorageConfigured && mode === "write" && parts.includes("catalogue");
  // Asked before the transaction opens, so no lock waits on Storage.
  const uploadAt = storage ? await storageArm.lookupUploads(uploadPathsIn(args)) : undefined;
  let removed: string[] = [];
  let result: T;
  try {
    result = await getDb().transaction(
      async (tx) => {
        if (mode === "write") for (const part of parts) await tx.execute(writeLock(part));
        const loaded = await load(tx, parts, uploadAt);
        const value = await withStandInStore(loaded.store, work);
        if (mode === "write") {
          await save(tx, loaded);
          removed = imagesRemovedBy(loaded);
        } else if (Object.values(changes(loaded)).some(Boolean)) {
          throw new Error("An Admin read changed the data; it must be run as a write.");
        }
        return value;
      },
      mode === "read" ? { isolationLevel: "repeatable read", accessMode: "read only" } : undefined,
    );
  } catch (error) {
    throw asDatabaseError(error);
  }
  // Committed. A failed delete is logged inside, and never fails the save.
  if (storage && removed.length > 0) await storageArm.removeImages(removed);
  return result;
}

type Call<Args extends unknown[], Result> = (...args: Args) => Promise<Result>;

const read =
  <Args extends unknown[], Result>(parts: readonly Part[], call: Call<Args, Result>) =>
  (...args: Args): Promise<Result> =>
    onDatabase(parts, "read", () => call(...args));

const write =
  <Args extends unknown[], Result>(parts: readonly Part[], call: Call<Args, Result>) =>
  (...args: Args): Promise<Result> =>
    onDatabase(parts, "write", () => call(...args), args);

/**
 * A write that saves a stamped record. Should its stamp have changed in the
 * database after the call read it, it answers conflict, with who saved it.
 */
const stampedWrite =
  <Args extends unknown[], Value>(call: Call<Args, AdminResult<Value>>) =>
  async (...args: Args): Promise<AdminResult<Value>> => {
    try {
      return await onDatabase(["catalogue"], "write", () => call(...args), args);
    } catch (error) {
      if (!(error instanceof StaleStampError)) throw error;
      const { recordStamps } = schema;
      const rows = await getDb()
        .select()
        .from(recordStamps)
        .where(inArray(recordStamps.record, [error.record, SEEDED_RECORD]))
        .catch((failure: unknown) => {
          throw asDatabaseError(failure);
        });
      const { seededAt, stamps } = stampsFromRows(rows);
      const stamp = stamps[error.record] ?? { savedAt: seededAt, savedBy: null };
      return { ok: false, error: { kind: "conflict", ...stamp } };
    }
  };

// ── The seam ────────────────────────────────────────────────────────────────

/** The newest denied sign-in for an email, read straight from its table. */
async function getLatestDeniedSignIn(email: string): Promise<DeniedSignIn | null> {
  const wanted = staffEmailSchema.safeParse(email);
  if (!wanted.success) return null;
  const { deniedSignIns } = schema;
  try {
    const [row] = await getDb()
      .select()
      .from(deniedSignIns)
      .where(eq(deniedSignIns.email, wanted.data))
      // The first one recorded, of those at the newest time (as the sample arm).
      .orderBy(desc(deniedSignIns.at), asc(deniedSignIns.seq))
      .limit(1);
    return row ? deniedSignInFromRow(row) : null;
  } catch (error) {
    throw asDatabaseError(error);
  }
}

const CATALOGUE: readonly Part[] = ["catalogue"];
const STAFF: readonly Part[] = ["staff"];

/**
 * An Invite. The staff list's own check refuses an email already on it; should
 * one be added by a save that skipped the lock, the database's unique key
 * refuses it too, and that says the same, on the email field.
 */
const inviteStaff: AdminService["inviteStaff"] = async (actor, input) => {
  try {
    return await onDatabase(STAFF, "write", () => sampleArm.inviteStaff(actor, input));
  } catch (error) {
    if (postgresErrorCode(error) !== UNIQUE_VIOLATION) throw error;
    return { ok: false, error: { kind: "invalid", fieldErrors: { email: [ALREADY_ON_LIST] } } };
  }
};

export const databaseArm: AdminService = {
  // Sign-in, and Staff and Invites.
  resolveSignIn: write(STAFF, sampleArm.resolveSignIn),
  recordDeniedSignIn: write([], sampleArm.recordDeniedSignIn),
  getLatestDeniedSignIn,
  getStaffByEmail: read(STAFF, sampleArm.getStaffByEmail),
  recordSignIn: write(STAFF, sampleArm.recordSignIn),
  listStaff: read(STAFF, sampleArm.listStaff),
  inviteStaff,
  renewInvite: write(STAFF, sampleArm.renewInvite),
  cancelInvite: write(STAFF, sampleArm.cancelInvite),
  changeStaffRole: write(STAFF, sampleArm.changeStaffRole),
  removeStaff: write(STAFF, sampleArm.removeStaff),

  getOverview: read(CATALOGUE, sampleArm.getOverview),

  getSettingsForAdmin: read(CATALOGUE, sampleArm.getSettingsForAdmin),
  updateWebsiteSettings: stampedWrite(sampleArm.updateWebsiteSettings),

  listProductsForAdmin: read(CATALOGUE, sampleArm.listProductsForAdmin),
  setProductFlags: stampedWrite(sampleArm.setProductFlags),
  listExamsForAdmin: read(CATALOGUE, sampleArm.listExamsForAdmin),
  getProductForAdmin: read(CATALOGUE, sampleArm.getProductForAdmin),
  createProduct: stampedWrite(sampleArm.createProduct),
  updateProduct: stampedWrite(sampleArm.updateProduct),
  previewProductDelete: read(CATALOGUE, sampleArm.previewProductDelete),
  deleteProduct: stampedWrite(sampleArm.deleteProduct),

  listReviewsForAdmin: read(CATALOGUE, sampleArm.listReviewsForAdmin),
  getReviewForAdmin: read(CATALOGUE, sampleArm.getReviewForAdmin),
  createReview: stampedWrite(sampleArm.createReview),
  updateReview: stampedWrite(sampleArm.updateReview),
  setReviewPinned: stampedWrite(sampleArm.setReviewPinned),
  moveReviewPin: stampedWrite(sampleArm.moveReviewPin),
  previewReviewDelete: read(CATALOGUE, sampleArm.previewReviewDelete),
  deleteReview: stampedWrite(sampleArm.deleteReview),

  listFaqsForAdmin: read(CATALOGUE, sampleArm.listFaqsForAdmin),
  getFaqForAdmin: read(CATALOGUE, sampleArm.getFaqForAdmin),
  createFaq: stampedWrite(sampleArm.createFaq),
  updateFaq: stampedWrite(sampleArm.updateFaq),
  moveFaq: stampedWrite(sampleArm.moveFaq),
  deleteFaq: stampedWrite(sampleArm.deleteFaq),

  getExamPageForAdmin: read(CATALOGUE, sampleArm.getExamPageForAdmin),
  updateExamHeader: stampedWrite(sampleArm.updateExamHeader),
  updateSubjectNames: stampedWrite(sampleArm.updateSubjectNames),
  setExamSection: stampedWrite(sampleArm.setExamSection),
  updateBundleOffer: stampedWrite(sampleArm.updateBundleOffer),
  updateExamSeo: stampedWrite(sampleArm.updateExamSeo),
  updateOfficialExamDate: stampedWrite(sampleArm.updateOfficialExamDate),

  getSitePageForAdmin: read(CATALOGUE, sampleArm.getSitePageForAdmin),
  updateSitePageSeo: stampedWrite(sampleArm.updateSitePageSeo),

  getPromoForAdmin: read(CATALOGUE, sampleArm.getPromoForAdmin),
  updatePromoBanner: stampedWrite(sampleArm.updatePromoBanner),
  setPromoBannerVisible: stampedWrite(sampleArm.setPromoBannerVisible),
  getAnnouncementForAdmin: read(CATALOGUE, sampleArm.getAnnouncementForAdmin),
  updateAnnouncement: stampedWrite(sampleArm.updateAnnouncement),
};
