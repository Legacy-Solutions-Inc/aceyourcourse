import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/connect";
import * as schema from "@/lib/db/schema";
import { describeWithDatabase, openTestDatabase } from "@/lib/db/test-database";
import type { Product, ProductFilters, ReviewFilters } from "@/services/catalogue.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { resetSampleStore } from "@/services/mock/sample-store";

import { describeCatalogueContract } from "../../test/catalogue-contract";
import { databaseArm, loadTestCatalogue } from "../../test/catalogue-database";

// The Catalogue seam's database arm against local Supabase (`pnpm test:db`):
// the whole behaviour suite (test/catalogue-contract.ts), the seed's round trip
// through the tables, the schema's cascades and keys, and every Website query
// deep-equal to the sample arm's. Skips, saying why, without TEST_DATABASE_URL.

// Next's data cache doesn't exist here: every read goes straight through.
vi.mock("next/cache", () => ({
  unstable_cache: <T>(read: T) => read,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const testDb = vi.hoisted(() => ({ current: undefined as Database | undefined }));

vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    if (!testDb.current) throw new Error("No test database: this suite should have been skipped.");
    return testDb.current;
  },
}));

const database = await openTestDatabase();
if (database.sql) testDb.current = drizzle(database.sql, { schema });

/** The test database, inside the suite (it skips without one). */
function db(): Database {
  if (!testDb.current) throw new Error("No test database: this suite should have been skipped.");
  return testDb.current;
}

describeWithDatabase("catalogue seam on the database", database, () => {
  describeCatalogueContract(databaseArm(db));

  describe("the tables", () => {
    beforeAll(async () => {
      await loadTestCatalogue(db());
    });

    // Some tests delete rows: each one leaves the seed loaded.
    afterEach(async () => {
      await loadTestCatalogue(db());
    });

    it("hold the whole seed, read back unchanged", async () => {
      const { readCatalogue } = await import("./catalogue.db");
      const parts = ["exams", "settings", "products", "reviews", "faqs", "examPages"] as const;
      expect(await readCatalogue(db(), parts)).toEqual(CATALOGUE_SEED);
    });

    it("delete a Product's variations, photos, Listings, Subjects and Reviews with it, and drop the FAQ quote of its Review", async () => {
      // The Ultimate CE Posters 2.0 have Reviews, one of them quoted on the FAQ page.
      const posters = CATALOGUE_SEED.products.find((p) => p.slug === "ultimate-ce-posters-2-0");
      if (!posters) throw new Error("the seed has no ultimate-ce-posters-2-0");
      await db().delete(schema.products).where(eq(schema.products.id, posters.id));

      const left = async (table: typeof schema.productPhotos | typeof schema.productVariations) =>
        db().select().from(table).where(eq(table.productId, posters.id));
      expect(await left(schema.productPhotos)).toEqual([]);
      expect(await left(schema.productVariations)).toEqual([]);
      expect(
        await db()
          .select()
          .from(schema.productListings)
          .where(eq(schema.productListings.productId, posters.id)),
      ).toEqual([]);
      expect(
        await db()
          .select()
          .from(schema.productSubjects)
          .where(eq(schema.productSubjects.productId, posters.id)),
      ).toEqual([]);
      expect(
        await db().select().from(schema.reviews).where(eq(schema.reviews.productId, posters.id)),
      ).toEqual([]);
      const [faq] = await db().select().from(schema.faqs).where(eq(schema.faqs.slug, "posters"));
      expect(faq?.reviewQuoteReviewId).toBeNull();
    });

    it("drop an Exam page's bundle offer when its Product is deleted", async () => {
      await db().delete(schema.products).where(eq(schema.products.slug, "ce-review-bundle-3-in-1"));
      const [ce] = await db()
        .select()
        .from(schema.examPages)
        .where(eq(schema.examPages.examCode, "CE"));
      expect(ce?.bundleProductId).toBeNull();
    });

    it("refuse a second Product with the same slug", async () => {
      const [first] = await db().select().from(schema.products).limit(1);
      if (!first) throw new Error("the catalogue has no Products");
      await expect(
        db()
          .insert(schema.products)
          .values({ ...first, id: "prd-duplicate-slug" }),
      ).rejects.toThrow();
    });

    it("refuse a second Exam with the same code, and a second Subject with the same code in an Exam", async () => {
      const [exam] = await db().select().from(schema.exams).limit(1);
      const [subject] = await db().select().from(schema.subjects).limit(1);
      if (!exam || !subject) throw new Error("the catalogue has no Exams");
      await expect(db().insert(schema.exams).values(exam)).rejects.toThrow();
      await expect(db().insert(schema.subjects).values(subject)).rejects.toThrow();
    });

    it("refuse a Product Subject that isn't a Subject of the Product's Exam", async () => {
      // CE Formula Flash Cards (CE) can't cover FAR, a CPA Subject.
      await expect(
        db()
          .insert(schema.productSubjects)
          .values({ productId: "prd-001", examCode: "CPA", subjectCode: "FAR", position: 9 }),
      ).rejects.toThrow();
      await expect(
        db()
          .insert(schema.productSubjects)
          .values({ productId: "prd-001", examCode: "CE", subjectCode: "FAR", position: 9 }),
      ).rejects.toThrow();
    });

    it("refuse deleting an Exam that still has Products", async () => {
      await expect(db().delete(schema.exams).where(eq(schema.exams.code, "CE"))).rejects.toThrow();
    });
  });

  describe("the two arms agree", () => {
    type Arm = Omit<typeof import("./catalogue.db"), "readCatalogue">;

    /** Both arms, imported afresh under the Member App switch given. */
    async function arms(memberAppLive: boolean): Promise<[Arm, Arm]> {
      vi.stubEnv("MEMBER_APP_LIVE", String(memberAppLive));
      vi.resetModules();
      const arms = await Promise.all([import("./catalogue.mock"), import("./catalogue.db")]);
      vi.unstubAllEnvs();
      return arms;
    }

    beforeAll(async () => {
      resetSampleStore();
      await loadTestCatalogue(db());
    });

    const seed = CATALOGUE_SEED;
    const examCodes = seed.exams.map((exam) => exam.code);
    const productFilters: ProductFilters[] = [
      {},
      ...examCodes.flatMap((examCode) => [{ examCode }, { examCode: examCode.toLowerCase() }]),
      ...(["flash-cards", "notebook", "posters", "bundle"] as const).map((format) => ({ format })),
      ...(["best-selling", "price-asc", "price-desc", "top-rated"] as const).map((sort) => ({
        sort,
      })),
      ...["poster", "MELE", "  medtech  ", "hydraulics", "ISBB", "Flash Cards", "pharmacy"].map(
        (query) => ({ query }),
      ),
      { maxPrice: 60000 },
      { maxPrice: 100 },
      { availableInApp: true },
      { availableInApp: false },
      { examCode: "CE", format: "posters", maxPrice: 50000 },
      { state: "coming-soon" },
      { state: "coming-soon", examCode: "EE" },
      { state: "coming-soon", format: "notebook", sort: "price-desc", maxPrice: 1 },
    ];
    const reviewFilters: ReviewFilters[] = [
      {},
      ...(["most-helpful", "highest", "most-critical", "most-detailed", "exam-page"] as const).map(
        (sort) => ({ sort }),
      ),
      ...(["5", "4", "3-or-less"] as const).map((stars) => ({ stars })),
      ...seed.products.map((p) => ({ productSlug: p.slug })),
      { productSlug: "nope" },
      ...examCodes.map((examCode) => ({ examCode, sort: "exam-page" as const })),
      { query: "GLOSSY" },
      { query: "bundle,160 gsm" },
      { examCode: "CE", sort: "exam-page", limit: 7 },
    ];
    const product = (slug: string): Product => {
      const found = seed.products.find((p) => p.slug === slug);
      if (!found) throw new Error(`the seed has no Product "${slug}"`);
      return found;
    };

    /** Every Website query, each with the arguments the pages give it. */
    const QUERIES: [string, (arm: Arm) => Promise<unknown>][] = [
      ["listExams()", (arm) => arm.listExams()],
      ...[...examCodes, "ce", "zz", "", "  "].flatMap(
        (code): [string, (arm: Arm) => Promise<unknown>][] => [
          [`getExamByCode(${JSON.stringify(code)})`, (arm) => arm.getExamByCode(code)],
          [`getExamPage(${JSON.stringify(code)})`, (arm) => arm.getExamPage(code)],
        ],
      ),
      ...productFilters.map((filters): [string, (arm: Arm) => Promise<unknown>] => [
        `listProducts(${JSON.stringify(filters)})`,
        (arm) => arm.listProducts(filters),
      ]),
      ...[...seed.products.map((p) => p.slug), "nope", "CE-FORMULA-FLASH-CARDS"].map(
        (slug): [string, (arm: Arm) => Promise<unknown>] => [
          `getProductBySlug(${JSON.stringify(slug)})`,
          (arm) => arm.getProductBySlug(slug),
        ],
      ),
      ...seed.products.flatMap((p): [string, (arm: Arm) => Promise<unknown>][] => [
        [`listRelatedProducts(${p.slug})`, (arm) => arm.listRelatedProducts(product(p.slug))],
        [`listRelatedProducts(${p.slug}, 1)`, (arm) => arm.listRelatedProducts(product(p.slug), 1)],
      ]),
      ["listBestSellers(3)", (arm) => arm.listBestSellers(3)],
      ["listBestSellers(50)", (arm) => arm.listBestSellers(50)],
      ...reviewFilters.map((filters): [string, (arm: Arm) => Promise<unknown>] => [
        `listReviews(${JSON.stringify(filters)})`,
        (arm) => arm.listReviews(filters),
      ]),
      ["listHomeReviews()", (arm) => arm.listHomeReviews()],
      ["listFaqs()", (arm) => arm.listFaqs()],
      ["getWebsiteSettings()", (arm) => arm.getWebsiteSettings()],
    ];

    it.each([false, true])(
      "gives the same answer to every Website query, with the Member App switch %s",
      async (memberAppLive) => {
        const [sample, fromDatabase] = await arms(memberAppLive);
        for (const [label, query] of QUERIES) {
          expect(await query(fromDatabase), label).toEqual(await query(sample));
        }
      },
    );

    it("gives the same answers once the data differs from the seed", async () => {
      // A hidden Live Product, a Product with no Shopee figures and a hidden FAQ group.
      const edited = structuredClone(seed);
      for (const p of edited.products) {
        if (p.slug === "cpa-flash-cards") p.showOnWebsite = false;
        if (p.slug === "ce-formula-flash-cards") p.shopee = null;
      }
      for (const faq of edited.faqs) if (faq.group === "authenticity") faq.showOnFaqPage = false;
      resetSampleStore(edited);
      await loadTestCatalogue(db(), edited);

      try {
        const [sample, fromDatabase] = await arms(false);
        for (const [label, query] of QUERIES) {
          expect(await query(fromDatabase), label).toEqual(await query(sample));
        }
      } finally {
        resetSampleStore();
        await loadTestCatalogue(db());
      }
    });
  });
});
