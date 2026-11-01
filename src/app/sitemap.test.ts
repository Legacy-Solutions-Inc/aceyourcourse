import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../test/catalogue-seed";

// The sitemap route, read from the Catalogue seam (the real seed, or an edited
// copy of it). Its URLs are on the site-URL setting, "http://localhost:3000/"
// with NEXT_PUBLIC_SITE_URL unset.

/** The sitemap's URLs, freshly built from the seed, or from an edited copy of it. */
async function sitemapUrls(editSeed?: (seed: CatalogueSeed) => void) {
  vi.resetModules();
  if (editSeed) {
    editSampleCatalogue(editSeed);
  }
  const { default: sitemap } = await import("./sitemap");
  return (await sitemap()).map((entry) => entry.url);
}

const sitemapPaths = async (editSeed: (seed: CatalogueSeed) => void) =>
  (await sitemapUrls(editSeed)).map((url) => new URL(url).pathname);

const hide = (seed: CatalogueSeed, slugs: string[]) => {
  for (const product of seed.products) {
    if (slugs.includes(product.slug)) product.showOnWebsite = false;
  }
};

// Every test starts from the seed, whatever the one before it edited.
afterEach(() => {
  resetSampleStore();
});

describe("sitemap", () => {
  it("lists the static pages, every Exam and every Product on the Website, Live and Coming Soon", async () => {
    const urls = await sitemapUrls();

    expect(urls.slice(0, 7)).toEqual([
      "http://localhost:3000/",
      "http://localhost:3000/products",
      "http://localhost:3000/reviews",
      "http://localhost:3000/faq",
      "http://localhost:3000/about",
      "http://localhost:3000/legal/privacy",
      "http://localhost:3000/legal/terms",
    ]);
    expect(urls.filter((url) => url.includes("/exams/"))).toEqual([
      "http://localhost:3000/exams/ce",
      "http://localhost:3000/exams/me",
      "http://localhost:3000/exams/ee",
      "http://localhost:3000/exams/mt",
      "http://localhost:3000/exams/cpa",
    ]);
    const products = urls.filter((url) => url.includes("/products/"));
    expect(products).toHaveLength(15);
    expect(products).toEqual(
      expect.arrayContaining([
        "http://localhost:3000/products/ce-formula-flash-cards",
        "http://localhost:3000/products/ce-solving-notebook",
      ]),
    );
  });

  it("leaves out a Product that isn't shown on the Website", async () => {
    const paths = await sitemapPaths((seed) =>
      hide(seed, ["ce-formula-flash-cards", "ce-solving-notebook"]),
    );
    expect(paths).not.toContain("/products/ce-formula-flash-cards");
    expect(paths).not.toContain("/products/ce-solving-notebook");
    expect(paths.filter((path) => path.startsWith("/products/"))).toHaveLength(13);
  });

  it("leaves out an Exam with no Product on the Website", async () => {
    const paths = await sitemapPaths((seed) =>
      hide(
        seed,
        seed.products.filter((product) => product.examCode === "CPA").map((p) => p.slug),
      ),
    );
    expect(paths).not.toContain("/exams/cpa");
    expect(paths).toContain("/exams/ce");
  });

  it("lists only the static pages when no Product is on the Website", async () => {
    const paths = await sitemapPaths((seed) =>
      hide(
        seed,
        seed.products.map((product) => product.slug),
      ),
    );
    expect(paths).toEqual([
      "/",
      "/products",
      "/reviews",
      "/faq",
      "/about",
      "/legal/privacy",
      "/legal/terms",
    ]);
  });
});
