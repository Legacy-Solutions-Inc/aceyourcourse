import { describe, expect, it } from "vitest";

import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { convertSpreadsheet } from "./build";
import { HAND_MAINTAINED, productRow, spreadsheet } from "../../../test/fixtures/catalogue-import";

// Converting the spreadsheet's rows into the seed's Exams, Products and
// Reviews, then checking the result with the seam's own seed validation. Its
// errors are mapped back to the sheet, row and column the client typed.

const CARDS = "ce-formula-flash-cards";
const NOTEBOOK = "ce-solving-notebook";

describe("convertSpreadsheet: a valid spreadsheet", () => {
  const { catalogue, photos, errors } = convertSpreadsheet(spreadsheet(), HAND_MAINTAINED);

  it("has no errors", () => {
    expect(errors).toEqual([]);
  });

  it("builds each Exam with its Subjects in their order", () => {
    expect(catalogue.exams).toEqual([
      {
        code: "CE",
        board: "CELE",
        name: "Civil Engineering",
        longName: "Civil Engineering Licensure Exam",
        blurb: "Three subjects, four formats.",
        madeFor: "Engineers needing a quick formula reference",
        subjects: [
          { code: "MSTC", name: "Mathematics, Surveying & Transportation" },
          { code: "HPGE", name: "Hydraulics & Geotechnical" },
          { code: "PSAD", name: "Structural Analysis & Design" },
        ],
      },
    ]);
  });

  it("builds a Live Product: prices in centavos, variations in order, photos with alt text", () => {
    expect(catalogue.products[0]).toEqual({
      id: "prd-001",
      slug: CARDS,
      examCode: "CE",
      title: "Civil Engineering Formula Flash Cards",
      shortName: "CE Formula Flash Cards",
      format: "flash-cards",
      size: "4 × 6 in · 160 gsm",
      edition: "Second Edition",
      subjectCodes: ["MSTC", "HPGE", "PSAD"],
      state: "live",
      priceFrom: 120000,
      priceTo: 124950,
      variations: [
        { name: "BUNDLE", price: 120000 },
        { name: "MSTC ONLY", price: 124950 },
      ],
      photos: [
        {
          src: "/products/ce-formula-flash-cards/1.webp",
          alt: "Civil Engineering Formula Flash Cards, photo 1 of 2",
        },
        {
          src: "/products/ce-formula-flash-cards/2.webp",
          alt: "Civil Engineering Formula Flash Cards, photo 2 of 2",
        },
      ],
      listings: { shopee: "https://shopee.ph/ce-cards-i.1276620555.24292303887" },
      shopee: { rating: 4.8, ratingCount: 197, unitsSold: 764, asOf: "2026-10-29" },
      deal: true,
      availableInApp: true,
      showOnWebsite: true,
      whatsInside: null,
      madeFor: null,
      seoTitle: null,
      seoDescription: null,
    });
  });

  it("builds a Coming Soon Product with no price, variations, Listings, figures or photos", () => {
    expect(catalogue.products[1]).toMatchObject({
      id: "prd-002",
      state: "coming-soon",
      priceFrom: null,
      priceTo: null,
      variations: [],
      photos: [],
      listings: {},
      shopee: null,
    });
  });

  it("builds each Review on its Product, from Shopee, with its text untouched", () => {
    expect(catalogue.reviews).toEqual([
      {
        id: "rev-001",
        productId: "prd-001",
        stars: 5,
        text: "Suitability: very useful\nQuality: clear, easy to read.",
        variation: "BUNDLE SECOND ED.",
        helpful: 8,
        marketplace: "shopee",
        homePin: 1,
      },
    ]);
  });

  it("lists each photo to keep or optimise, cover first", () => {
    expect(photos).toEqual([
      {
        slug: CARDS,
        row: 2,
        ref: "/products/ce-formula-flash-cards/1.webp",
        src: "/products/ce-formula-flash-cards/1.webp",
      },
      {
        slug: CARDS,
        row: 2,
        ref: "/products/ce-formula-flash-cards/2.webp",
        src: "/products/ce-formula-flash-cards/2.webp",
      },
    ]);
  });
});

describe("convertSpreadsheet: photo files", () => {
  it("serves a photo file from /products/{slug}/{n}.webp, numbered by its place", () => {
    const { catalogue, photos } = convertSpreadsheet(
      spreadsheet((sheets) => {
        productRow(sheets, CARDS).photos = "cover.jpg|/products/ce-formula-flash-cards/2.webp";
      }),
      HAND_MAINTAINED,
    );

    expect(catalogue.products[0]?.photos.map((photo) => photo.src)).toEqual([
      "/products/ce-formula-flash-cards/1.webp",
      "/products/ce-formula-flash-cards/2.webp",
    ]);
    expect(photos[0]).toEqual({
      slug: CARDS,
      row: 2,
      ref: "cover.jpg",
      src: "/products/ce-formula-flash-cards/1.webp",
    });
  });
});

describe("convertSpreadsheet: row errors", () => {
  /** The errors for a fixture spreadsheet edited by the test. */
  const errorsOf = (edit: Parameters<typeof spreadsheet>[0]) =>
    convertSpreadsheet(spreadsheet(edit), HAND_MAINTAINED).errors;

  it("reports an unknown exam_code on products.csv", () => {
    expect(errorsOf((sheets) => (productRow(sheets, NOTEBOOK).exam_code = "XX"))).toEqual([
      { sheet: "products", row: 3, column: "exam_code", message: 'unknown Exam "XX"' },
    ]);
  });

  it("reports a Subject code that isn't on the Product's Exam", () => {
    expect(errorsOf((sheets) => (productRow(sheets, CARDS).subject_codes = "MSTC|GEO"))).toEqual([
      {
        sheet: "products",
        row: 2,
        column: "subject_codes",
        message: '"GEO" is not a Subject of CE',
      },
    ]);
  });

  it("reports a duplicate slug at the second row that uses it", () => {
    expect(errorsOf((sheets) => (productRow(sheets, NOTEBOOK).slug = CARDS))).toEqual([
      { sheet: "products", row: 3, column: "slug", message: `duplicate slug "${CARDS}"` },
    ]);
  });

  it("reports a Lazada Listing on a shopee.ph link", () => {
    const errors = errorsOf((sheets) => {
      productRow(sheets, CARDS).lazada_url = "https://shopee.ph/ce-cards-i.1.2";
    });

    expect(errors).toEqual([
      { sheet: "products", row: 2, column: "lazada_url", message: "must be a lazada.com.ph link" },
    ]);
  });

  it("reports a Coming Soon row with a price", () => {
    expect(errorsOf((sheets) => (productRow(sheets, NOTEBOOK).price_from = "500"))).toEqual([
      {
        sheet: "products",
        row: 3,
        column: "price_from",
        message: "a Coming Soon Product has no price",
      },
    ]);
  });

  it("reports a Coming Soon row with a Listing, Shopee figures or a variation", () => {
    const errors = errorsOf((sheets) => {
      Object.assign(productRow(sheets, NOTEBOOK), {
        tiktok_url: "https://www.tiktok.com/@aceyourcourse",
        shopee_rating: "5",
        shopee_ratings: "1",
        units_sold: "1",
        figures_as_of: "2026-10-29",
      });
      sheets.variations.push({ product_slug: NOTEBOOK, name: "A5", price: "500", order: "1" });
    });

    expect(errors).toEqual([
      {
        sheet: "products",
        row: 3,
        column: "tiktok_url",
        message: "a Coming Soon Product has no Listings",
      },
      {
        sheet: "products",
        row: 3,
        column: "shopee_rating",
        message: "a Coming Soon Product has no Shopee figures",
      },
      {
        sheet: "variations",
        row: 4,
        column: "product_slug",
        message: "a Coming Soon Product has no variations",
      },
    ]);
  });

  it("reports a Live row with no price, and one with no photos", () => {
    const errors = errorsOf((sheets) => {
      Object.assign(productRow(sheets, CARDS), { price_from: "", price_to: "", photos: "" });
    });

    expect(errors).toEqual([
      {
        sheet: "products",
        row: 2,
        column: "price_from",
        message: "a Live Product needs a price above 0",
      },
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message: "a Live Product needs at least one photo",
      },
    ]);
  });

  it("reports a variation price of 0 at its row on variations.csv", () => {
    expect(
      errorsOf((sheets) => (sheets.variations[0] = { ...sheets.variations[0], price: "0" })),
    ).toEqual([{ sheet: "variations", row: 2, column: "price", message: "must be above 0" }]);
  });

  it("reports a Review for an unknown product_slug", () => {
    expect(
      errorsOf((sheets) =>
        sheets.reviews.push({ product_slug: "cpa-cards", stars: "5", text: "Good" }),
      ),
    ).toEqual([
      { sheet: "reviews", row: 3, column: "product_slug", message: 'unknown Product "cpa-cards"' },
    ]);
  });

  it("reports a variation for an unknown product_slug", () => {
    expect(
      errorsOf((sheets) =>
        sheets.variations.push({ product_slug: "cpa-cards", name: "X", price: "1", order: "3" }),
      ),
    ).toEqual([
      {
        sheet: "variations",
        row: 4,
        column: "product_slug",
        message: 'unknown Product "cpa-cards"',
      },
    ]);
  });

  it("reports a Subject of an unknown Exam", () => {
    expect(
      errorsOf((sheets) =>
        sheets.subjects.push({ exam_code: "ee", code: "ESAS", name: "ES", order: "1" }),
      ),
    ).toEqual([{ sheet: "subjects", row: 5, column: "exam_code", message: 'unknown Exam "EE"' }]);
  });

  it("reports an Exam with no Subjects at its row on exams.csv", () => {
    expect(errorsOf((sheets) => (sheets.subjects = []))).toEqual([
      expect.objectContaining({
        sheet: "exams",
        row: 2,
        message: "an Exam needs at least one Subject",
      }),
      // With no Subjects, the Products' Subject codes are unknown too.
      ...Array.from({ length: 6 }, () => expect.objectContaining({ column: "subject_codes" })),
    ]);
  });

  it("reports every error in one run, sorted by sheet and row", () => {
    // Found in another order: the unreadable cells first, then the unknown
    // Products, then what seed validation finds (row 2's Exam).
    const errors = errorsOf((sheets) => {
      productRow(sheets, CARDS).exam_code = "XX";
      productRow(sheets, NOTEBOOK).price_from = "abc";
      sheets.reviews.push({ product_slug: "cpa-cards", stars: "5", text: "Good" });
      sheets.reviews.push({ product_slug: "cpa-cards", stars: "6", text: "Good" });
    });

    expect(errors.map(({ sheet, row, column }) => `${sheet} ${row} ${column}`)).toEqual([
      "products 2 exam_code",
      "products 3 price_from",
      "reviews 3 product_slug",
      "reviews 4 stars",
      "reviews 4 product_slug",
    ]);
  });

  it("reports a row's other problems too when one of its cells can't be read", () => {
    const errors = errorsOf((sheets) => {
      Object.assign(productRow(sheets, CARDS), {
        price_from: "abc",
        lazada_url: "https://shopee.ph/ce-cards-i.1.2",
      });
    });

    // And not "a Live Product needs a price above 0": that is about the stand-in.
    expect(errors).toEqual([
      {
        sheet: "products",
        row: 2,
        column: "price_from",
        message: '"abc" is not a peso amount (write it like 1200 or ₱1,249.50)',
      },
      { sheet: "products", row: 2, column: "lazada_url", message: "must be a lazada.com.ph link" },
    ]);
  });

  it("checks a row with an unreadable state by the rules its price suggests", () => {
    const errors = errorsOf((sheets) => {
      productRow(sheets, CARDS).state = "on sale";
      productRow(sheets, NOTEBOOK).state = "soon";
    });

    expect(errors.map(({ row, column }) => `${row} ${column}`)).toEqual(["2 state", "3 state"]);
  });

  it("doesn't call a Product unknown when its own row couldn't be read", () => {
    const errors = errorsOf((sheets) => (productRow(sheets, CARDS).deal = "maybe"));

    expect(errors).toEqual([
      { sheet: "products", row: 2, column: "deal", message: 'must be yes or no, not "maybe"' },
    ]);
  });

  it("reports a sheet that can't be read as CSV, with no row", () => {
    const sheets = spreadsheet();
    const { errors } = convertSpreadsheet(
      { ...sheets, reviews: `${sheets.reviews}\n"unclosed` },
      HAND_MAINTAINED,
    );

    expect(errors).toEqual([
      expect.objectContaining({ sheet: "reviews", row: null, column: null }),
    ]);
    expect(errors[0]?.message).toMatch(/^can't be read as CSV/);
  });
});

describe("convertSpreadsheet: the hand-maintained settings, FAQs and Exam pages", () => {
  it("reports an FAQ quote that no longer matches its Review, with no sheet", () => {
    const [faq] = CATALOGUE_SEED.faqs;
    if (!faq) throw new Error("the seed has no FAQs");
    const { errors } = convertSpreadsheet(spreadsheet(), {
      ...HAND_MAINTAINED,
      faqs: [{ ...faq, reviewQuote: { reviewId: "rev-001", text: "not in it" } }],
    });

    expect(errors).toEqual([
      {
        sheet: null,
        row: null,
        column: null,
        message: 'faqs.0.reviewQuote.text: must be word for word from Review "rev-001"',
      },
    ]);
  });

  it("reports an Exam page bundle offer whose Product the spreadsheet no longer has", () => {
    const [page] = CATALOGUE_SEED.examPages;
    if (!page?.bundleOffer) throw new Error("the seed's first Exam page has no bundle offer");
    const { errors } = convertSpreadsheet(spreadsheet(), {
      ...HAND_MAINTAINED,
      examPages: [{ ...page, bundleOffer: { ...page.bundleOffer, productId: "prd-404" } }],
    });

    expect(errors).toEqual([
      {
        sheet: null,
        row: null,
        column: null,
        message: 'examPages.0.bundleOffer.productId: unknown Product "prd-404"',
      },
    ]);
  });
});
