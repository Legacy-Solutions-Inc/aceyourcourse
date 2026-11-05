import { afterEach, describe, expect, it, vi } from "vitest";

import { aboutCopy } from "@/content/about";
import { faqPageCopy } from "@/content/faq-page";
import { homeCopy } from "@/content/home";
import { productsPageCopy } from "@/content/products-page";
import { reviewsPageCopy } from "@/content/reviews-page";
import { SITE_PAGES } from "@/services/catalogue.schema";
import type { SitePage, SitePageKey } from "@/services/catalogue.types";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../../test/catalogue-seed";
import {
  SITE_PAGE_DEFAULTS,
  sitePageAddress,
  sitePageMetadata,
  sitePageSeo,
} from "./site-page-seo";

// A read that fails, as an unreachable database's does.
const reads = vi.hoisted(() => ({ failure: null as Error | null }));
vi.mock("@/services/catalogue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/catalogue")>();
  return {
    ...actual,
    getSitePage: (page: SitePageKey) =>
      reads.failure ? Promise.reject(reads.failure) : actual.getSitePage(page),
  };
});

// Each Site page's search title, description and share image (ticket 20;
// spec, Phase 2 → Site pages), read from the Catalogue seam over the sample
// data. Blank uses today's text in src/content, and the site's share image.

const SHARE = "/api/dev/uploads/share-faq";
const savedAbout: SitePage = {
  page: "about",
  seoTitle: "About us · board passers from Iloilo",
  seoDescription: "d".repeat(120),
  shareImage: null,
  about: null,
};

afterEach(() => {
  reads.failure = null;
  vi.restoreAllMocks();
  resetSampleStore();
});

describe("SITE_PAGE_DEFAULTS", () => {
  it("is today's text in code, and each page's address", () => {
    expect(SITE_PAGE_DEFAULTS).toEqual({
      home: { path: "/", title: homeCopy.metaTitle, description: homeCopy.metaDescription },
      about: { path: "/about", title: aboutCopy.metaTitle, description: aboutCopy.metaDescription },
      products: {
        path: "/products",
        title: productsPageCopy.metaTitle,
        description: productsPageCopy.metaDescription,
      },
      faq: { path: "/faq", title: faqPageCopy.metaTitle, description: faqPageCopy.metaDescription },
      reviews: {
        path: "/reviews",
        title: reviewsPageCopy.metaTitle,
        description: reviewsPageCopy.metaDescription,
      },
    });
  });
});

describe("sitePageAddress", () => {
  it.each([
    ["home", "aceyourcourse.ph/"],
    ["about", "aceyourcourse.ph/about"],
    ["faq", "aceyourcourse.ph/faq"],
  ] as const)("shows %s as %s, the site root for Home", (page, address) => {
    expect(sitePageAddress(page)).toBe(address);
  });
});

describe("sitePageSeo", () => {
  it("uses the saved title and description", () => {
    expect(sitePageSeo(savedAbout)).toEqual({
      title: savedAbout.seoTitle,
      description: savedAbout.seoDescription,
    });
  });

  it("uses today's text for a blank field", () => {
    expect(sitePageSeo({ ...savedAbout, seoDescription: null })).toEqual({
      title: savedAbout.seoTitle,
      description: aboutCopy.metaDescription,
    });
  });
});

describe("sitePageMetadata", () => {
  it.each(SITE_PAGES)("gives %s today's metadata while it has no record", async (page) => {
    const { path, title, description } = SITE_PAGE_DEFAULTS[page];
    const shareTitle = `${title} · Ace Your Course`;
    const images = [{ url: "/opengraph-image", alt: "Ace Your Course" }];
    expect(await sitePageMetadata(page)).toEqual({
      title,
      description,
      alternates: { canonical: path },
      openGraph: {
        type: "website",
        siteName: "Ace Your Course",
        locale: "en_PH",
        title: shareTitle,
        description,
        url: path,
        images,
      },
      twitter: { card: "summary_large_image", title: shareTitle, description, images },
    });
  });

  it("uses the saved title and description everywhere the page names itself", async () => {
    editSampleCatalogue((seed) => {
      seed.sitePages = [savedAbout];
    });
    const metadata = await sitePageMetadata("about");
    const shareTitle = `${savedAbout.seoTitle} · Ace Your Course`;

    expect(metadata).toMatchObject({
      title: savedAbout.seoTitle,
      description: savedAbout.seoDescription,
      alternates: { canonical: "/about" },
      openGraph: { title: shareTitle, description: savedAbout.seoDescription, url: "/about" },
      twitter: { title: shareTitle, description: savedAbout.seoDescription },
    });
  });

  it("shares the page's own image, named by its title", async () => {
    editSampleCatalogue((seed) => {
      seed.sitePages = [
        { page: "faq", seoTitle: null, seoDescription: null, shareImage: SHARE, about: null },
      ];
    });
    const metadata = await sitePageMetadata("faq");
    const images = [{ url: SHARE, alt: faqPageCopy.metaTitle }];

    expect(metadata.openGraph).toMatchObject({ images });
    expect(metadata.twitter).toMatchObject({ images });
    // The other pages keep the site's image.
    expect((await sitePageMetadata("home")).openGraph).toMatchObject({
      images: [{ url: "/opengraph-image", alt: "Ace Your Course" }],
    });
  });

  it("falls back to today's metadata when the read fails, and logs it once", async () => {
    const failure = new Error("The database didn't answer (CONNECT_TIMEOUT).");
    reads.failure = failure;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const metadata = await sitePageMetadata("reviews");

    expect(metadata).toMatchObject({
      title: reviewsPageCopy.metaTitle,
      description: reviewsPageCopy.metaDescription,
      alternates: { canonical: "/reviews" },
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("reviews"), failure);
  });
});
