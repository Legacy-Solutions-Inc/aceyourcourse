import { afterEach, describe, expect, it, vi } from "vitest";

import { CATALOGUE_SEED } from "@/services/mock/catalogue";

// The seam (catalogue.ts) selects its arm from DATABASE_URL at import time.
// These tests import it again under each setting and check where its reads
// come from: the sample data by default, the database arm when a database is
// configured. The database arm is replaced by a stand-in that answers with
// its own name, so nothing connects. Mirrors the template's Customers selector
// test (git history at aea34ea, customers.selector.test.ts).

type Seam = typeof import("./catalogue");

const [aProduct] = CATALOGUE_SEED.products;
if (!aProduct) throw new Error("the seed has no Products");

/** Every read of the seam, called as a page would. */
const READS: [string, (seam: Seam) => Promise<unknown>][] = [
  ["listExams", (seam) => seam.listExams()],
  ["getExamByCode", (seam) => seam.getExamByCode("ce")],
  ["getExamPage", (seam) => seam.getExamPage("ce")],
  ["listProducts", (seam) => seam.listProducts()],
  ["getProductBySlug", (seam) => seam.getProductBySlug(aProduct.slug)],
  ["listRelatedProducts", (seam) => seam.listRelatedProducts(aProduct)],
  ["listBestSellers", (seam) => seam.listBestSellers(3)],
  ["listReviews", (seam) => seam.listReviews()],
  ["listHomeReviews", (seam) => seam.listHomeReviews()],
  ["listFaqs", (seam) => seam.listFaqs()],
  ["getWebsiteSettings", (seam) => seam.getWebsiteSettings()],
];

/** Imports the seam with DATABASE_URL as given, over the stand-in database arm. */
async function seamWithDatabaseUrl(url: string) {
  vi.stubEnv("DATABASE_URL", url);
  vi.resetModules();
  vi.doMock("@/services/catalogue.db", () =>
    Object.fromEntries(READS.map(([name]) => [name, async () => `database arm: ${name}`])),
  );
  return import("./catalogue");
}

describe("catalogue seam selector", () => {
  afterEach(() => {
    vi.doUnmock("@/services/catalogue.db");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(READS)("reads %s from the database arm when DATABASE_URL is set", async (name, read) => {
    const seam = await seamWithDatabaseUrl("postgresql://user:pass@127.0.0.1:54322/postgres");
    expect(await read(seam)).toBe(`database arm: ${name}`);
  });

  it.each(READS)("reads %s from the sample data when DATABASE_URL is unset", async (name, read) => {
    const seam = await seamWithDatabaseUrl("");
    expect(await read(seam)).not.toBe(`database arm: ${name}`);
  });

  it("serves the seed's Website settings from the sample data when DATABASE_URL is unset", async () => {
    const seam = await seamWithDatabaseUrl("");
    expect((await seam.getWebsiteSettings()).contactEmail).toBe(
      CATALOGUE_SEED.settings.contactEmail,
    );
  });
});
