import { sql } from "drizzle-orm";

import type { Database } from "@/lib/db/connect";
import * as schema from "@/lib/db/schema";
import { SEEDED_RECORD, staffToRows } from "@/services/admin.rows";
import { catalogueToRows } from "@/services/catalogue.rows";
import { type CatalogueSeed, validateCatalogueSeed } from "@/services/catalogue.schema";
import { sampleStaff } from "@/services/mock/staff";

import { type SeedPhotos, seedPhotoPlan } from "./photos";

// ─────────────────────────────────────────────────────────────────────────────
// Loading the catalogue seed into Postgres, for `pnpm catalogue:seed`
// (scripts/catalogue-seed.ts) and the database tests. The seed is validated
// before anything is written, then written in one transaction, so a failure
// leaves the catalogue as it was. Locally the seed replaces the catalogue and
// the Admin's data, adding the sample Staff for "Sign in as" (CONVENTIONS §5);
// in production it loads only into an empty catalogue, never deletes, and
// never adds Staff. With Storage (the command), every seed photo is read from
// public/ before anything is written, then uploaded into the bucket inside
// the transaction, and the Products are loaded with the bucket URLs.
// ─────────────────────────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** What a load wrote, for the command's report. */
export interface SeedCounts {
  exams: number;
  subjects: number;
  liveProducts: number;
  comingSoonProducts: number;
  reviews: number;
  faqs: number;
}

/** The sample staff list a local load adds. */
export interface SampleStaffCounts {
  staff: number;
  invites: number;
}

export type SeedOutcome =
  | {
      ok: true;
      counts: SeedCounts;
      sampleStaff: SampleStaffCounts | null;
      /** How many photos went into Storage; null when the photos stayed in public/. */
      uploadedPhotos: number | null;
    }
  | { ok: false; reason: "invalid"; errors: string[] }
  | { ok: false; reason: "photos"; problems: string[] }
  | { ok: false; reason: "not-empty" };

/** Pure: the counts the command reports for a seed. */
export function seedCounts(seed: CatalogueSeed): SeedCounts {
  return {
    exams: seed.exams.length,
    subjects: seed.exams.reduce((total, exam) => total + exam.subjects.length, 0),
    liveProducts: seed.products.filter((p) => p.state === "live").length,
    comingSoonProducts: seed.products.filter((p) => p.state === "coming-soon").length,
    reviews: seed.reviews.length,
    faqs: seed.faqs.length,
  };
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Pure: the counts as the command prints them, one line each. */
export function formatSeedCounts(counts: SeedCounts): string[] {
  const products = counts.liveProducts + counts.comingSoonProducts;
  return [
    `${plural(counts.exams, "Exam")}, ${plural(counts.subjects, "Subject")}`,
    `${plural(products, "Product")} (${counts.liveProducts} Live, ${counts.comingSoonProducts} Coming Soon)`,
    plural(counts.reviews, "Review"),
    plural(counts.faqs, "FAQ"),
  ];
}

/** Pure: the line the command prints for the sample staff a local load added. */
export function formatSampleStaff({ staff, invites }: SampleStaffCounts): string {
  return `${plural(staff, "sample Staff User")} and ${plural(invites, "Invite")}, for "Sign in as"`;
}

/** Every Catalogue table, parents before children, the order rows are written in. */
const TABLES = [
  schema.exams,
  schema.subjects,
  schema.products,
  schema.productSubjects,
  schema.productVariations,
  schema.productPhotos,
  schema.productListings,
  schema.reviews,
  schema.faqs,
  schema.examPages,
  schema.sitePages,
  schema.websiteSettings,
  schema.announcementMessages,
  schema.promoBanner,
];

/** Whether any Catalogue table has a row. */
async function hasCatalogue(tx: Transaction): Promise<boolean> {
  for (const table of TABLES) {
    const [row] = await tx
      .select({ one: sql`1` })
      .from(table)
      .limit(1);
    if (row) return true;
  }
  return false;
}

/**
 * The Admin's own tables. They describe the catalogue that is loaded (its
 * save stamps, who changed it), so a local load replaces them too.
 */
const ADMIN_TABLES = [
  schema.staffActivity,
  schema.deniedSignIns,
  schema.recordStamps,
  schema.staff,
];

/** Deletes every Catalogue row, children before parents. */
export async function clearCatalogue(db: Database | Transaction): Promise<void> {
  for (const table of [...TABLES].reverse()) await db.delete(table);
}

/** Records when the catalogue was loaded: the stamp of every record nobody has saved since. */
async function stampSeed(tx: Transaction, now: Date): Promise<void> {
  await tx
    .insert(schema.recordStamps)
    .values({ record: SEEDED_RECORD, updatedAt: now, updatedBy: null })
    .onConflictDoUpdate({
      target: schema.recordStamps.record,
      set: { updatedAt: now, updatedBy: null },
    });
}

/** Replaces the Admin's data with the sample staff list, timed from `now`. */
async function writeSampleStaff(tx: Transaction, now: Date): Promise<SampleStaffCounts> {
  for (const table of ADMIN_TABLES) await tx.delete(table);
  const list = sampleStaff(now);
  await tx.insert(schema.staff).values(staffToRows(list));
  return { staff: list.staff.length, invites: list.invites.length };
}

async function writeCatalogue(tx: Transaction, seed: CatalogueSeed): Promise<void> {
  const rows = catalogueToRows(seed);
  // One insert per table, in TABLES order, skipping the empty ones.
  if (rows.exams.length) await tx.insert(schema.exams).values(rows.exams);
  if (rows.subjects.length) await tx.insert(schema.subjects).values(rows.subjects);
  if (rows.products.length) await tx.insert(schema.products).values(rows.products);
  if (rows.productSubjects.length) {
    await tx.insert(schema.productSubjects).values(rows.productSubjects);
  }
  if (rows.productVariations.length) {
    await tx.insert(schema.productVariations).values(rows.productVariations);
  }
  if (rows.productPhotos.length) await tx.insert(schema.productPhotos).values(rows.productPhotos);
  if (rows.productListings.length) {
    await tx.insert(schema.productListings).values(rows.productListings);
  }
  if (rows.reviews.length) await tx.insert(schema.reviews).values(rows.reviews);
  if (rows.faqs.length) await tx.insert(schema.faqs).values(rows.faqs);
  if (rows.examPages.length) await tx.insert(schema.examPages).values(rows.examPages);
  if (rows.sitePages.length) await tx.insert(schema.sitePages).values(rows.sitePages);
  await tx.insert(schema.websiteSettings).values(rows.websiteSettings);
  if (rows.announcementMessages.length) {
    await tx.insert(schema.announcementMessages).values(rows.announcementMessages);
  }
  if (rows.promoBanner.length) await tx.insert(schema.promoBanner).values(rows.promoBanner);
}

/** The seed's photo files, read before anything is written, or what's wrong with them. */
async function readSeedPhotos(
  seed: CatalogueSeed,
  photos: SeedPhotos,
): Promise<{ ok: true; files: Map<string, Uint8Array> } | { ok: false; problems: string[] }> {
  const plan = seedPhotoPlan(seed);
  const problems = plan
    .filter((photo) => photo.contentType === null)
    .map((photo) => `${photo.src}: not a JPEG, PNG or WebP`);
  if (problems.length > 0) return { ok: false, problems };

  const files = new Map<string, Uint8Array>();
  for (const { src } of plan) {
    if (files.has(src)) continue;
    const bytes = await photos.read(src);
    if (bytes) files.set(src, bytes);
    else problems.push(`${src}: no such file in public/`);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, files };
}

/** Uploads each seed photo into the bucket, and gives the seed with the photos' bucket URLs. */
async function uploadSeedPhotos(
  seed: CatalogueSeed,
  photos: SeedPhotos,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<{ seed: CatalogueSeed; uploaded: number }> {
  const inBucket = structuredClone(seed);
  const plan = seedPhotoPlan(seed);
  for (const { productId, index, src, path, contentType } of plan) {
    const bytes = files.get(src);
    const photo = inBucket.products.find((p) => p.id === productId)?.photos[index];
    if (!bytes || !contentType || !photo) throw new Error(`The seed photo ${src} wasn't read.`);
    photo.src = await photos.upload(path, bytes, contentType);
  }
  return { seed: inBucket, uploaded: plan.length };
}

/** The seed once validated, with its photo files read when there are photos to upload. */
type PreparedSeed =
  | { ok: true; seed: CatalogueSeed; files: Map<string, Uint8Array> | null }
  | { ok: false; reason: "invalid"; errors: string[] }
  | { ok: false; reason: "photos"; problems: string[] };

/** Validates the seed and reads its photos, before the database is touched. */
async function prepareSeed(seed: unknown, photos: SeedPhotos | undefined): Promise<PreparedSeed> {
  const validation = validateCatalogueSeed(seed);
  if (!validation.success) return { ok: false, reason: "invalid", errors: validation.errors };
  if (!photos) return { ok: true, seed: validation.data, files: null };
  const read = await readSeedPhotos(validation.data, photos);
  if (!read.ok) return { ok: false, reason: "photos", problems: read.problems };
  return { ok: true, seed: validation.data, files: read.files };
}

/**
 * Validates the seed, then writes it in one transaction. Without
 * `production`, it replaces whatever catalogue is there, and the Admin's data
 * with the sample staff list, timed from `now`. With it, it refuses when any
 * Catalogue row exists, deletes nothing and adds no Staff. An invalid seed, or
 * with `photos` a missing photo file, is refused before the database is
 * touched. With `photos`, the photos are uploaded once the transaction knows
 * it will load; without, they stay at their public/ paths.
 */
export async function seedCatalogue(
  db: Database,
  seed: unknown,
  {
    production = false,
    now = new Date(),
    photos,
  }: { production?: boolean; now?: Date; photos?: SeedPhotos } = {},
): Promise<SeedOutcome> {
  const prepared = await prepareSeed(seed, photos);
  if (!prepared.ok) return prepared;
  const { seed: valid, files } = prepared;

  return db.transaction(async (tx): Promise<SeedOutcome> => {
    if (production) {
      if (await hasCatalogue(tx)) return { ok: false, reason: "not-empty" };
    } else {
      await clearCatalogue(tx);
    }
    const loaded = photos && files ? await uploadSeedPhotos(valid, photos, files) : null;
    await writeCatalogue(tx, loaded?.seed ?? valid);
    const staff = production ? null : await writeSampleStaff(tx, now);
    await stampSeed(tx, now);
    return {
      ok: true,
      counts: seedCounts(valid),
      sampleStaff: staff,
      uploadedPhotos: loaded?.uploaded ?? null,
    };
  });
}

/** What the one-time production load would do, from its dry run. */
export type SeedPlan =
  | {
      ok: true;
      counts: SeedCounts;
      /** How many photos would go into Storage; null when the photos would stay in public/. */
      photos: number | null;
    }
  | { ok: false; reason: "invalid"; errors: string[] }
  | { ok: false; reason: "photos"; problems: string[] }
  | { ok: false; reason: "not-empty" };

/**
 * The dry run of `seedCatalogue(…, { production: true })`, for
 * `catalogue:seed --production --check`: the same validation and photo
 * reads, then whether the catalogue is empty, read in a READ ONLY
 * transaction. It writes nothing and uploads nothing.
 */
export async function planCatalogueSeed(
  db: Database,
  seed: unknown,
  { photos }: { photos?: SeedPhotos } = {},
): Promise<SeedPlan> {
  const prepared = await prepareSeed(seed, photos);
  if (!prepared.ok) return prepared;
  const hasData = await db.transaction(hasCatalogue, { accessMode: "read only" });
  if (hasData) return { ok: false, reason: "not-empty" };
  return {
    ok: true,
    counts: seedCounts(prepared.seed),
    photos: prepared.files ? seedPhotoPlan(prepared.seed).length : null,
  };
}
