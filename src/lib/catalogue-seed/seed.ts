import { sql } from "drizzle-orm";

import type { Database } from "@/lib/db/connect";
import * as schema from "@/lib/db/schema";
import { SEEDED_RECORD, staffToRows } from "@/services/admin.rows";
import { catalogueToRows } from "@/services/catalogue.rows";
import { type CatalogueSeed, validateCatalogueSeed } from "@/services/catalogue.schema";
import { sampleStaff } from "@/services/mock/staff";

// ─────────────────────────────────────────────────────────────────────────────
// Loading the catalogue seed into Postgres, for `pnpm catalogue:seed`
// (scripts/catalogue-seed.ts) and the database tests. The seed is validated
// before anything is written, then written in one transaction, so a failure
// leaves the catalogue as it was. Locally the seed replaces the catalogue and
// the Admin's data, adding the sample Staff for "Sign in as" (CONVENTIONS §5);
// in production it loads only into an empty catalogue, never deletes, and
// never adds Staff.
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
  | { ok: true; counts: SeedCounts; sampleStaff: SampleStaffCounts | null }
  | { ok: false; reason: "invalid"; errors: string[] }
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
  await tx.insert(schema.websiteSettings).values(rows.websiteSettings);
  if (rows.announcementMessages.length) {
    await tx.insert(schema.announcementMessages).values(rows.announcementMessages);
  }
  if (rows.promoBanner.length) await tx.insert(schema.promoBanner).values(rows.promoBanner);
}

/**
 * Validates the seed, then writes it in one transaction. Without
 * `production`, it replaces whatever catalogue is there, and the Admin's data
 * with the sample staff list, timed from `now`. With it, it refuses when any
 * Catalogue row exists, deletes nothing and adds no Staff. An invalid seed is
 * refused before the database is touched.
 */
export async function seedCatalogue(
  db: Database,
  seed: unknown,
  { production = false, now = new Date() }: { production?: boolean; now?: Date } = {},
): Promise<SeedOutcome> {
  const validation = validateCatalogueSeed(seed);
  if (!validation.success) return { ok: false, reason: "invalid", errors: validation.errors };
  const valid = validation.data;

  return db.transaction(async (tx): Promise<SeedOutcome> => {
    if (production) {
      if (await hasCatalogue(tx)) return { ok: false, reason: "not-empty" };
    } else {
      await clearCatalogue(tx);
    }
    await writeCatalogue(tx, valid);
    const staff = production ? null : await writeSampleStaff(tx, now);
    await stampSeed(tx, now);
    return { ok: true, counts: seedCounts(valid), sampleStaff: staff };
  });
}
