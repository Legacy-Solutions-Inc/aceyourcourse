import { describe, expect, it } from "vitest";

import { emptyAbout } from "@/lib/catalogue/about-content";

import {
  catalogueFromRows,
  catalogueToRows,
  examPagesFromRows,
  examsFromRows,
  faqsFromRows,
  productsFromRows,
  reviewsFromRows,
  settingsFromRows,
  sitePagesFromRows,
  type CatalogueRows,
} from "./catalogue.rows";
import { CATALOGUE_SEED } from "./mock/catalogue";

// The database arm's pure row mappers (catalogue.rows.ts), with no database:
// the seed goes into rows for `pnpm catalogue:seed`, and rows come back as the
// seam's types. Mirrors the template's Customers mapper test (git history at
// aea34ea, customers.db.test.ts).

const rows = (): CatalogueRows => catalogueToRows(structuredClone(CATALOGUE_SEED));

/** The rows of every table, last first, as a database may return them. */
function reversed(all: CatalogueRows): CatalogueRows {
  return Object.fromEntries(
    Object.entries(all).map(([table, list]) => [table, [...list].reverse()]),
  ) as unknown as CatalogueRows;
}

function productRows(all: CatalogueRows, id: string) {
  const product = all.products.find((p) => p.id === id);
  if (!product) throw new Error(`the seed has no Product "${id}"`);
  return product;
}

describe("catalogue rows: the seed round trip", () => {
  it("gives back the whole seed from its rows, unchanged", () => {
    expect(catalogueFromRows(rows())).toEqual(CATALOGUE_SEED);
  });

  it("keeps every list in seed order, whatever order the rows come in", () => {
    expect(catalogueFromRows(reversed(rows()))).toEqual(CATALOGUE_SEED);
  });

  it("keeps money in whole centavos", () => {
    const all = rows();
    const bundle = all.products.find((p) => p.slug === "ce-review-bundle-3-in-1");
    expect(bundle).toMatchObject({ priceFrom: expect.any(Number), priceTo: 349900 });
    for (const variation of all.productVariations) {
      expect(Number.isInteger(variation.price), variation.name).toBe(true);
    }
  });

  it("writes one row per Subject, photo, variation and Listing, and none for a missing Listing", () => {
    const all = rows();
    const seed = CATALOGUE_SEED;
    expect(all.subjects).toHaveLength(seed.exams.flatMap((e) => e.subjects).length);
    expect(all.productPhotos).toHaveLength(seed.products.flatMap((p) => p.photos).length);
    expect(all.productVariations).toHaveLength(seed.products.flatMap((p) => p.variations).length);
    expect(all.productListings).toHaveLength(
      seed.products.flatMap((p) => Object.keys(p.listings)).length,
    );
    expect(all.promoBanner).toHaveLength(1);
    expect(all.websiteSettings).toHaveLength(1);
  });

  it("gives back Site page records unchanged, About's text and photos too, in seed order, and writes none while there are none", () => {
    expect(rows().sitePages).toEqual([]);
    const seed = structuredClone(CATALOGUE_SEED);
    const about = emptyAbout();
    about.roots.heading = "Packed in Iloilo.";
    about.story.photos[1] = { src: "/api/dev/uploads/1", alt: "A reviewee and her package" };
    seed.sitePages = [
      {
        page: "faq",
        seoTitle: null,
        seoDescription: null,
        shareImage: "/share/faq.png",
        about: null,
      },
      {
        page: "about",
        seoTitle: "About us",
        seoDescription: "Who we are.",
        shareImage: null,
        about,
      },
    ];
    const written = catalogueToRows(seed);
    expect(written.sitePages).toEqual([
      {
        page: "faq",
        position: 0,
        seoTitle: null,
        seoDescription: null,
        shareImage: "/share/faq.png",
        about: null,
      },
      {
        page: "about",
        position: 1,
        seoTitle: "About us",
        seoDescription: "Who we are.",
        shareImage: null,
        // About's text and photos, as one record.
        about,
      },
    ]);
    expect(sitePagesFromRows([...written.sitePages].reverse())).toEqual(seed.sitePages);
    expect(catalogueFromRows(written)).toEqual(seed);
  });

  it("writes no promo banner row when the seed has none, and reads none back", () => {
    const seed = structuredClone(CATALOGUE_SEED);
    seed.settings.promoBanner = null;
    const all = catalogueToRows(seed);
    expect(all.promoBanner).toEqual([]);
    expect(settingsFromRows(all).promoBanner).toBeNull();
  });
});

describe("catalogue rows: rows to the seam's types", () => {
  it("gives an Exam its Subjects in order, and none when it has no Subject rows", () => {
    const all = rows();
    const exams = examsFromRows({ exams: all.exams, subjects: reversed(all).subjects });
    expect(exams[0]?.subjects.map((s) => s.code)).toEqual(["MSTC", "HPGE", "PSAD"]);
    expect(examsFromRows({ exams: all.exams.slice(0, 1), subjects: [] })[0]?.subjects).toEqual([]);
  });

  it("gives a Product no Shopee figures unless all four are set", () => {
    const all = rows();
    const product = productRows(all, "prd-001");
    expect(productsFromRows({ ...all, products: [product] })[0]?.shopee).toEqual({
      rating: 4.8,
      ratingCount: 197,
      unitsSold: 764,
      asOf: "2026-10-29",
    });
    const partial = { ...product, shopeeUnitsSold: null };
    expect(productsFromRows({ ...all, products: [partial] })[0]?.shopee).toBeNull();
  });

  it("lists a Product's Listings by Marketplace, leaving out the ones it doesn't have", () => {
    const all = rows();
    const product = productRows(all, "prd-001");
    const listings = [
      { productId: product.id, marketplace: "tiktok" as const, url: "https://vt.tiktok.com/x" },
      { productId: product.id, marketplace: "shopee" as const, url: "https://shopee.ph/x" },
    ];
    const [mapped] = productsFromRows({ ...all, products: [product], productListings: listings });
    expect(mapped?.listings).toEqual({
      shopee: "https://shopee.ph/x",
      tiktok: "https://vt.tiktok.com/x",
    });
    expect(Object.keys(mapped?.listings ?? {})).toEqual(["shopee", "tiktok"]);
  });

  it("gives a Product with no child rows no Subjects, variations, photos or Listings", () => {
    const all = rows();
    const [mapped] = productsFromRows({
      products: [productRows(all, "prd-001")],
      productSubjects: [],
      productVariations: [],
      productPhotos: [],
      productListings: [],
    });
    expect(mapped).toMatchObject({ subjectCodes: [], variations: [], photos: [], listings: {} });
  });

  it("drops an FAQ's quote once its Review is gone (the foreign key set it to null)", () => {
    const posters = rows().faqs.find((faq) => faq.slug === "posters");
    if (!posters) throw new Error("the seed has no posters FAQ");
    expect(faqsFromRows([posters])[0]?.reviewQuote?.reviewId).toBe("rev-014");
    expect(faqsFromRows([{ ...posters, reviewQuoteReviewId: null }])[0]?.reviewQuote).toBeNull();
  });

  it("drops an Exam page's bundle offer once its Product is gone (the foreign key set it to null)", () => {
    const ce = rows().examPages.find((page) => page.examCode === "CE");
    if (!ce) throw new Error("the seed has no CE Exam page");
    expect(examPagesFromRows([ce])[0]?.bundleOffer?.productId).toBe("prd-008");
    const [page] = examPagesFromRows([{ ...ce, bundleProductId: null }]);
    expect(page?.bundleOffer).toBeNull();
    expect(page?.sections).toEqual({ subjects: true, bundleOffer: true, reviews: true });
  });

  it.each([0, 6, 2.5])("refuses a Review row with %s stars", (stars) => {
    const [review] = rows().reviews;
    if (!review) throw new Error("the seed has no Reviews");
    expect(() => reviewsFromRows([{ ...review, stars }])).toThrow(
      `Review "${review.id}" has ${stars} stars; a Review has 1 to 5.`,
    );
  });

  it("says to seed the catalogue when there is no Website settings row", () => {
    expect(() =>
      settingsFromRows({ websiteSettings: [], announcementMessages: [], promoBanner: [] }),
    ).toThrow("The catalogue has no Website settings. Load it with `pnpm catalogue:seed`.");
  });

  it("lists the announcement's messages in order", () => {
    const all = rows();
    const settings = settingsFromRows({
      ...all,
      announcementMessages: reversed(all).announcementMessages,
    });
    expect(settings.announcement.messages.map((m) => m.href)).toEqual([
      "/products",
      "/app",
      "/faq",
    ]);
  });
});
