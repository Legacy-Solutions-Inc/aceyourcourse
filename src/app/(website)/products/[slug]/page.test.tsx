import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../../../../test/catalogue-seed";

// The Product page's own decisions, called directly rather than rendered: its
// metadata, and the 404 for an unknown or hidden Product. Rendering is covered
// by the component tests and e2e/product.spec.ts.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

async function loadPage(editSeed?: (seed: CatalogueSeed) => void) {
  vi.resetModules();
  if (editSeed) {
    editSampleCatalogue(editSeed);
  }
  const page = await import("./page");
  return page;
}

const props = (slug: string) => ({ params: Promise.resolve({ slug }) });

// Every test starts from the seed, whatever the one before it edited.
afterEach(() => {
  resetSampleStore();
});

describe("Product page", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("titles and describes a Live Product, with its canonical URL and cover as the share image", async () => {
    const { generateMetadata } = await loadPage();
    const metadata = await generateMetadata(props("ce-formula-flash-cards"));
    expect(metadata.title).toEqual({
      absolute: "CE Formula Flash Cards · CELE Reviewer · Ace Your Course",
    });
    expect(metadata.description).toMatch(/^Civil Engineering Formula Flash Cards for the CELE/);
    expect(metadata.alternates?.canonical).toBe("/products/ce-formula-flash-cards");
    expect(metadata.openGraph).toMatchObject({
      url: "/products/ce-formula-flash-cards",
      images: [
        {
          url: "/products/ce-formula-flash-cards/1.webp",
          alt: "Civil Engineering Formula Flash Cards, photo 1 of 8",
        },
      ],
    });
  });

  it("leaves a Coming Soon Product on the site's default share image", async () => {
    const { generateMetadata } = await loadPage();
    const metadata = await generateMetadata(props("ce-solving-notebook"));
    expect(metadata.description).toMatch(/^Coming soon: /);
    expect(metadata.openGraph).toMatchObject({
      images: [{ url: "/opengraph-image", alt: "Ace Your Course" }],
    });
  });

  it("is not found for an unknown slug", async () => {
    const { default: ProductPage, generateMetadata } = await loadPage();
    await expect(ProductPage(props("no-such-product"))).rejects.toThrow("NEXT_NOT_FOUND");
    // Metadata stays empty; the page's notFound() renders the 404 in the shell.
    await expect(generateMetadata(props("no-such-product"))).resolves.toEqual({});
  });

  it("is not found for a Product with Show on website off", async () => {
    const { default: ProductPage } = await loadPage((seed) => {
      const hidden = seed.products.find((p) => p.slug === "cpa-flash-cards");
      if (!hidden) throw new Error("the seed has no cpa-flash-cards");
      hidden.showOnWebsite = false;
    });
    await expect(ProductPage(props("cpa-flash-cards"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders for a Live Product", async () => {
    const { default: ProductPage } = await loadPage();
    await expect(ProductPage(props("ce-formula-flash-cards"))).resolves.toBeTruthy();
  });
});
