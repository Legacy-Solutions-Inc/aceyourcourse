import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { cachedTags, clearFakeCache, fakeNextCache } from "../../test/fake-next-cache";
import * as seam from "./catalogue";

// The Catalogue seam's reads are cached with tags (CONVENTIONS §3), so the
// Website is fast though every page renders per request, and an Admin save
// clears exactly the reads it affects. Here Next's data cache is a fake that
// honours tags; elsewhere the shared setup passes every read straight through.
vi.mock("next/cache", async () => (await import("../../test/fake-next-cache")).fakeNextCache);

const { revalidateTag } = fakeNextCache;

beforeEach(() => {
  resetSampleStore();
  clearFakeCache();
});

afterEach(() => {
  resetSampleStore();
});

describe("catalogue seam: cache tags", () => {
  const READS: [string, () => Promise<unknown>, string[]][] = [
    ["listExams", () => seam.listExams(), ["catalogue:exams", "catalogue:products"]],
    ["getExamByCode", () => seam.getExamByCode("ce"), ["catalogue:exams"]],
    ["listProducts", () => seam.listProducts(), ["catalogue:products", "catalogue:exams"]],
    ["getProductBySlug", () => seam.getProductBySlug("cpa-flash-cards"), ["catalogue:products"]],
    [
      "listRelatedProducts",
      async () => {
        const product = await seam.getProductBySlug("cpa-flash-cards");
        clearFakeCache();
        if (!product) throw new Error("the seed has no cpa-flash-cards");
        return seam.listRelatedProducts(product);
      },
      ["catalogue:products"],
    ],
    ["listBestSellers", () => seam.listBestSellers(3), ["catalogue:products"]],
    ["listReviews", () => seam.listReviews(), ["catalogue:reviews", "catalogue:products"]],
    ["listHomeReviews", () => seam.listHomeReviews(), ["catalogue:reviews", "catalogue:products"]],
    [
      "listFaqs",
      () => seam.listFaqs(),
      ["catalogue:faqs", "catalogue:reviews", "catalogue:products"],
    ],
    ["getWebsiteSettings", () => seam.getWebsiteSettings(), ["catalogue:settings"]],
    ["getExamPage", () => seam.getExamPage("ce"), ["catalogue:exam-pages", "catalogue:products"]],
  ];

  it.each(READS)("tags %s with catalogue and the areas it reads", async (_name, read, tags) => {
    await read();
    expect(cachedTags().map((entry) => [...entry].sort())).toEqual([["catalogue", ...tags].sort()]);
  });
});

describe("catalogue seam: cached reads", () => {
  const NEW_EMAIL = "hello@aceyourcourse.ph";
  const SEED_EMAIL = "aceyourcourseinc@gmail.com";

  it("serves a cached read until its tag is cleared", async () => {
    expect((await seam.getWebsiteSettings()).contactEmail).toBe(SEED_EMAIL);
    getSampleStore().catalogue.settings.contactEmail = NEW_EMAIL;

    expect((await seam.getWebsiteSettings()).contactEmail).toBe(SEED_EMAIL);
    revalidateTag("catalogue:settings");
    expect((await seam.getWebsiteSettings()).contactEmail).toBe(NEW_EMAIL);
  });

  it("keeps the Product reads cached when only the settings tag is cleared", async () => {
    const title = async () => (await seam.getProductBySlug("cpa-flash-cards"))?.title;
    const seedTitle = await title();
    const cpa = getSampleStore().catalogue.products.find((p) => p.slug === "cpa-flash-cards");
    if (!cpa) throw new Error("the seed has no cpa-flash-cards");
    cpa.title = "Renamed";

    revalidateTag("catalogue:settings");
    expect(await title()).toBe(seedTitle);
    revalidateTag("catalogue");
    expect(await title()).toBe("Renamed");
  });

  it("never serves what was cached before the sample data started again (a restart or Reset)", async () => {
    getSampleStore().catalogue.settings.contactEmail = NEW_EMAIL;
    expect((await seam.getWebsiteSettings()).contactEmail).toBe(NEW_EMAIL);

    // A new generation of the sample data, with nothing cleared from the cache.
    resetSampleStore();
    expect((await seam.getWebsiteSettings()).contactEmail).toBe(SEED_EMAIL);
  });
});
