import "server-only";

import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import {
  examPagesFromRows,
  examsFromRows,
  faqsFromRows,
  productsFromRows,
  reviewsFromRows,
  settingsFromRows,
  type CataloguePart,
} from "@/services/catalogue.rows";
import { catalogueReads, type LoadCatalogue } from "@/services/catalogue.rules";
import type { CatalogueSeed } from "@/services/catalogue.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Drizzle-backed implementation of the Catalogue seam. Selected by
// src/services/catalogue.ts when DATABASE_URL is set. It reads the parts of the
// catalogue a read needs from Postgres, maps the rows to the seam's types
// (catalogue.rows.ts), and applies the same rules as the sample arm
// (catalogue.rules.ts). See docs/adr/0006-drizzle-data-layer.md.
// ─────────────────────────────────────────────────────────────────────────────

type Reader = Pick<Database, "select">;

/** How each part of the catalogue is read: its tables' rows, mapped. */
const PART_READERS: { [Part in CataloguePart]: (db: Reader) => Promise<CatalogueSeed[Part]> } = {
  exams: async (db) =>
    examsFromRows({
      exams: await db.select().from(schema.exams),
      subjects: await db.select().from(schema.subjects),
    }),
  products: async (db) =>
    productsFromRows({
      products: await db.select().from(schema.products),
      productSubjects: await db.select().from(schema.productSubjects),
      productVariations: await db.select().from(schema.productVariations),
      productPhotos: await db.select().from(schema.productPhotos),
      productListings: await db.select().from(schema.productListings),
    }),
  reviews: async (db) => reviewsFromRows(await db.select().from(schema.reviews)),
  faqs: async (db) => faqsFromRows(await db.select().from(schema.faqs)),
  examPages: async (db) => examPagesFromRows(await db.select().from(schema.examPages)),
  settings: async (db) =>
    settingsFromRows({
      websiteSettings: await db.select().from(schema.websiteSettings),
      announcementMessages: await db.select().from(schema.announcementMessages),
      promoBanner: await db.select().from(schema.promoBanner),
    }),
};

/**
 * The parts of the catalogue asked for, as the seed holds them, read in one
 * read-only transaction so they agree with each other.
 */
export async function readCatalogue<Part extends CataloguePart>(
  db: Database,
  parts: readonly Part[],
): Promise<Pick<CatalogueSeed, Part>> {
  return db.transaction(
    async (tx) => {
      const loaded: Partial<CatalogueSeed> = {};
      for (const part of new Set(parts)) {
        Object.assign(loaded, { [part]: await PART_READERS[part](tx) });
      }
      // Every part asked for was just read in.
      return loaded as Pick<CatalogueSeed, Part>;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/** Reads through the app's client. A database that doesn't answer gives a clear error. */
const load: LoadCatalogue = async (parts) => {
  try {
    return await readCatalogue(getDb(), parts);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

export const {
  listExams,
  getExamByCode,
  getExamPage,
  listProducts,
  getProductBySlug,
  listRelatedProducts,
  listBestSellers,
  listReviews,
  listHomeReviews,
  listFaqs,
  getWebsiteSettings,
} = catalogueReads(load);
