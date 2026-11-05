import { afterEach, describe, expect, it } from "vitest";

import type { SitePageKey } from "@/services/catalogue.types";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../../test/catalogue-seed";

// Each of the five Site pages takes its metadata from the Catalogue seam
// (ticket 20): what an Editor saves in Pages & promo shows on the page's
// next load, and its canonical address stays as it was.

const PAGES: [SitePageKey, string, () => Promise<{ generateMetadata: () => Promise<unknown> }>][] =
  [
    ["home", "/", () => import("./page")],
    ["about", "/about", () => import("./about/page")],
    ["products", "/products", () => import("./products/page")],
    ["faq", "/faq", () => import("./faq/page")],
    ["reviews", "/reviews", () => import("./reviews/page")],
  ];

afterEach(() => {
  resetSampleStore();
});

describe("Site pages' metadata", () => {
  it.each(PAGES)(
    "%s uses the title, description and share image saved in the Admin",
    async (page, path, load) => {
      editSampleCatalogue((seed) => {
        seed.sitePages = [
          {
            page,
            seoTitle: `Saved ${page} title`,
            seoDescription: `Saved ${page} description.`,
            shareImage: `/api/dev/uploads/share-${page}`,
          },
        ];
      });
      const { generateMetadata } = await load();
      const images = [{ url: `/api/dev/uploads/share-${page}`, alt: `Saved ${page} title` }];

      expect(await generateMetadata()).toMatchObject({
        title: `Saved ${page} title`,
        description: `Saved ${page} description.`,
        alternates: { canonical: path },
        openGraph: { title: `Saved ${page} title · Ace Your Course`, url: path, images },
        twitter: { title: `Saved ${page} title · Ace Your Course`, images },
      });
    },
  );
});
