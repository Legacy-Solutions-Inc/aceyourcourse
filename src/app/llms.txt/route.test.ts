import { afterEach, describe, expect, it, vi } from "vitest";

import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../../test/catalogue-seed";
import { dynamic, GET } from "./route";

// GET /llms.txt (ticket 22), read from the Catalogue seam over the sample
// data: the seed, or an edited copy of it. Its links are on the site-URL
// setting, "http://localhost:3000/" with NEXT_PUBLIC_SITE_URL unset.

// A read that fails, as an unreachable database's does.
const reads = vi.hoisted(() => ({ failure: null as Error | null }));
vi.mock("@/services/catalogue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/catalogue")>();
  return {
    ...actual,
    listFaqs: () => (reads.failure ? Promise.reject(reads.failure) : actual.listFaqs()),
  };
});

const summary = async () => (await GET()).text();

afterEach(() => {
  reads.failure = null;
  vi.restoreAllMocks();
  resetSampleStore();
});

describe("GET /llms.txt", () => {
  it("answers the summary as plain text, built on every request", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(dynamic).toBe("force-dynamic");
    const text = await response.text();
    expect(text.startsWith("# Ace Your Course\n")).toBe(true);
    expect(text).toContain(
      "- [Civil Engineering Formula Flash Cards](http://localhost:3000/products/ce-formula-flash-cards): ₱1,200. Buy on [Shopee](https://shopee.ph/",
    );
    expect(text).toContain(
      "- [Civil Engineering Licensure Exam page](http://localhost:3000/exams/ce)",
    );
    expect(text).toContain("- [Where do orders ship from?](http://localhost:3000/faq#faq-ship): ");
    // A Coming Soon Product follows its Exam's Live ones, with no price.
    expect(text).toContain(
      "- [Civil Engineering Solving Notebook](http://localhost:3000/products/ce-solving-notebook): Coming soon\n",
    );
  });

  it("gives every Exam on the Website a section, in the Website's order", async () => {
    const text = await summary();
    expect(text.match(/^## .+$/gm)).toEqual([
      "## Civil Engineering (CELE)",
      "## Mechanical Engineering (MELE)",
      "## Electrical Engineering (REE)",
      "## Medical Technology (MTLE)",
      "## Accountancy (CPALE)",
      "## FAQ",
      "## Pages",
      "## Shops",
    ]);
  });

  it("shows a price as soon as the catalogue changes", async () => {
    editSampleCatalogue((seed) => {
      const cards = seed.products.find((product) => product.slug === "ce-formula-flash-cards");
      if (cards) cards.priceFrom = 125000;
    });
    expect(await summary()).toContain(
      "- [Civil Engineering Formula Flash Cards](http://localhost:3000/products/ce-formula-flash-cards): ₱1,250.",
    );
  });

  it("leaves out a Product off the Website, and an Exam with no Product left on it", async () => {
    editSampleCatalogue((seed) => {
      for (const product of seed.products) {
        if (product.examCode === "CPA" || product.slug === "ce-solving-notebook") {
          product.showOnWebsite = false;
        }
      }
    });
    const text = await summary();
    expect(text).not.toContain("ce-solving-notebook");
    expect(text).not.toContain("## Accountancy");
    expect(text).not.toContain("/exams/cpa");
  });

  it("leaves out a hidden FAQ, and the Member App's FAQs while its switch is off", async () => {
    editSampleCatalogue((seed) => {
      const ship = seed.faqs.find((faq) => faq.slug === "ship");
      if (ship) ship.showOnFaqPage = false;
    });
    const text = await summary();
    expect(text).not.toContain("faq#faq-ship");
    expect(text).not.toContain("Is there a digital version?");
    expect(text).not.toMatch(/member app|\bplans?\b/i);
  });

  it("never carries Review text, ratings, rating counts or units sold", async () => {
    editSampleCatalogue((seed) => {
      const cards = seed.products.find((product) => product.slug === "ce-formula-flash-cards");
      if (cards)
        cards.shopee = { rating: 4.7, ratingCount: 98765, unitsSold: 43210, asOf: "2026-10-29" };
      seed.settings.shopStats = { ...seed.settings.shopStats, rating: 4.6, ratingCount: 87654 };
    });
    const text = await summary();
    for (const review of CATALOGUE_SEED.reviews) {
      expect(text).not.toContain(review.text.split("\n")[0]);
    }
    expect(text).not.toMatch(/98,?765|43,?210|87,?654|4\.7|4\.6/);
    expect(text).not.toMatch(/★|\bstars?\b|\brating/i);
  });

  it("answers 503 with a short message, never the error, when the catalogue can't be read", async () => {
    reads.failure = new Error("connect ECONNREFUSED 10.0.0.1:5432\n    at Socket.connect");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("The summary isn't available right now.");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("llms.txt"), reads.failure);
  });
});
