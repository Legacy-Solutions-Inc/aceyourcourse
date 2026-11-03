import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/connect";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { formatSeedCounts, seedCatalogue, seedCounts } from "./seed";

// The parts of `pnpm catalogue:seed` that need no database. Writing, the one
// transaction and --production's refusal are checked against Postgres in
// seed.db.test.ts.

/** A database that fails the test if anything touches it. */
const untouchable = new Proxy({} as Database, {
  get(_target, property) {
    throw new Error(`the database was touched (${String(property)})`);
  },
});

describe("catalogue seed: counts", () => {
  it("counts the seed's Exams, Subjects, Products by state, Reviews and FAQs", () => {
    expect(seedCounts(CATALOGUE_SEED)).toEqual({
      exams: CATALOGUE_SEED.exams.length,
      subjects: CATALOGUE_SEED.exams.flatMap((exam) => exam.subjects).length,
      liveProducts: 8,
      comingSoonProducts: 7,
      reviews: 16,
      faqs: 18,
    });
  });

  it("prints one line per kind of record", () => {
    expect(
      formatSeedCounts({
        exams: 11,
        subjects: 40,
        liveProducts: 8,
        comingSoonProducts: 7,
        reviews: 16,
        faqs: 18,
      }),
    ).toEqual([
      "11 Exams, 40 Subjects",
      "15 Products (8 Live, 7 Coming Soon)",
      "16 Reviews",
      "18 FAQs",
    ]);
  });

  it("says one of each in the singular", () => {
    expect(
      formatSeedCounts({
        exams: 1,
        subjects: 1,
        liveProducts: 1,
        comingSoonProducts: 0,
        reviews: 1,
        faqs: 1,
      }),
    ).toEqual(["1 Exam, 1 Subject", "1 Product (1 Live, 0 Coming Soon)", "1 Review", "1 FAQ"]);
  });
});

describe("catalogue seed: validation first", () => {
  it("refuses a Coming Soon Product with a price before touching the database", async () => {
    const seed = structuredClone(CATALOGUE_SEED);
    const soon = seed.products.find((p) => p.slug === "ce-solving-notebook");
    if (!soon) throw new Error("the seed has no ce-solving-notebook");
    soon.priceFrom = 50000;

    const index = seed.products.indexOf(soon);
    expect(await seedCatalogue(untouchable, seed)).toEqual({
      ok: false,
      reason: "invalid",
      errors: [`products.${index}.priceFrom: a Coming Soon Product has no price`],
    });
  });

  it("refuses something that isn't a seed at all, in production too", async () => {
    const outcome = await seedCatalogue(untouchable, { exams: "nope" }, { production: true });
    expect(outcome).toMatchObject({ ok: false, reason: "invalid" });
  });
});
