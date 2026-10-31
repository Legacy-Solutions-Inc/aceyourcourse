import { describe, expect, it } from "vitest";

import { readCsv } from "./parse";
import { parseSheet, type SheetName } from "./rows";
import { toCsv } from "../../../test/fixtures/catalogue-import";

// The row schemas read each sheet's cells into typed rows. Every problem is an
// error naming the sheet, the spreadsheet row and the column, and every row is
// read, so one run reports them all.

/** A sheet with its full header, and rows giving only the cells that matter. */
const csv = (sheet: SheetName, rows: Record<string, string>[]) => readCsv(toCsv(sheet, rows));

const LIVE_PRODUCT = {
  slug: "ce-formula-flash-cards",
  exam_code: "CE",
  title: "Civil Engineering Formula Flash Cards",
  short_name: "CE Formula Flash Cards",
  format: "flash cards",
  size: "4 × 6 in · 160 gsm",
  edition: "Second Edition",
  subject_codes: "MSTC|HPGE|PSAD",
  state: "live",
  price_from: "₱1,200",
  price_to: "",
  shopee_url: "https://shopee.ph/ce-cards-i.1.2",
  shopee_rating: "4.8",
  shopee_ratings: "197",
  units_sold: "764",
  figures_as_of: "2026-10-29",
  deal: "yes",
  available_in_app: "yes",
  show_on_website: "yes",
  photos: "cover.jpg|back.jpg",
};

const COMING_SOON_PRODUCT = {
  slug: "ce-solving-notebook",
  exam_code: "ce",
  title: "Civil Engineering Solving Notebook",
  short_name: "CE Solving Notebook",
  format: "Notebook",
  size: "A5",
  subject_codes: "MSTC|HPGE|PSAD",
  state: "Coming Soon",
  deal: "no",
  available_in_app: "no",
  show_on_website: "yes",
};

describe("parseSheet: products", () => {
  it("reads a Live row into typed values: centavos, lists, yes/no and Shopee figures", () => {
    const { rows, errors } = parseSheet("products", csv("products", [LIVE_PRODUCT]));

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        row: 2,
        data: expect.objectContaining({
          format: "flash-cards",
          state: "live",
          edition: "Second Edition",
          subject_codes: ["MSTC", "HPGE", "PSAD"],
          price_from: 120000,
          price_to: null,
          shopee_url: "https://shopee.ph/ce-cards-i.1.2",
          lazada_url: null,
          shopee: { rating: 4.8, ratingCount: 197, unitsSold: 764, asOf: "2026-10-29" },
          deal: true,
          whats_inside: null,
          made_for: null,
          photos: ["cover.jpg", "back.jpg"],
        }),
      },
    ]);
  });

  it("accepts a Coming Soon row with no price, Listings, figures or photos", () => {
    const { rows, errors } = parseSheet("products", csv("products", [COMING_SOON_PRODUCT]));

    expect(errors).toEqual([]);
    expect(rows[0]?.data).toMatchObject({
      exam_code: "CE",
      format: "notebook",
      state: "coming-soon",
      price_from: null,
      price_to: null,
      shopee_url: null,
      shopee: null,
      photos: [],
    });
  });

  it.each(["abc", "-5", "12.345"])("reports a bad price %j at its row and column", (price) => {
    const { errors } = parseSheet(
      "products",
      csv("products", [COMING_SOON_PRODUCT, { ...LIVE_PRODUCT, price_from: price }]),
    );

    expect(errors).toEqual([
      {
        sheet: "products",
        row: 3,
        column: "price_from",
        message: `"${price}" is not a peso amount (write it like 1200 or ₱1,249.50)`,
      },
    ]);
  });

  it("reports figures_as_of 2026-02-30 at its row and column", () => {
    const { errors } = parseSheet(
      "products",
      csv("products", [{ ...LIVE_PRODUCT, figures_as_of: "2026-02-30" }]),
    );

    expect(errors).toEqual([
      {
        sheet: "products",
        row: 2,
        column: "figures_as_of",
        message: '"2026-02-30" is not a real date (write it as YYYY-MM-DD)',
      },
    ]);
  });

  it("asks for all four Shopee figures or none", () => {
    const { errors } = parseSheet(
      "products",
      csv("products", [{ ...LIVE_PRODUCT, shopee_ratings: "", units_sold: "" }]),
    );

    expect(errors).toEqual([
      expect.objectContaining({ row: 2, column: "shopee_ratings" }),
      expect.objectContaining({ row: 2, column: "units_sold" }),
    ]);
    expect(errors[0]?.message).toBe(
      "fill in all four Shopee figures (shopee_rating, shopee_ratings, units_sold, figures_as_of), or leave all four blank",
    );
  });

  it("reports an unknown format, state or yes/no answer", () => {
    const { errors } = parseSheet(
      "products",
      csv("products", [{ ...LIVE_PRODUCT, format: "e-book", state: "sold out", deal: "maybe" }]),
    );

    expect(errors).toEqual([
      {
        sheet: "products",
        row: 2,
        column: "format",
        message: 'must be flash cards, notebook, posters or bundle, not "e-book"',
      },
      {
        sheet: "products",
        row: 2,
        column: "state",
        message: 'must be live or coming soon, not "sold out"',
      },
      { sheet: "products", row: 2, column: "deal", message: 'must be yes or no, not "maybe"' },
    ]);
  });

  it("reports every bad row in one pass, not only the first", () => {
    const { errors } = parseSheet(
      "products",
      csv("products", [
        { ...LIVE_PRODUCT, price_from: "abc" },
        COMING_SOON_PRODUCT,
        { ...LIVE_PRODUCT, slug: "x", exam_code: "" },
      ]),
    );

    expect(errors).toEqual([
      expect.objectContaining({ row: 2, column: "price_from" }),
      { sheet: "products", row: 4, column: "exam_code", message: "must not be blank" },
    ]);
  });

  it("still builds a row with unreadable cells, from stand-ins, so its other cells get checked", () => {
    const { rows } = parseSheet(
      "products",
      csv("products", [
        { ...LIVE_PRODUCT, price_from: "abc", exam_code: "", deal: "maybe" },
        { ...COMING_SOON_PRODUCT, state: "soon", format: "e-book" },
        { ...LIVE_PRODUCT, state: "on sale", shopee_ratings: "" },
      ]),
    );

    expect(rows.map(({ row, data }) => ({ row, ...data }))).toEqual([
      expect.objectContaining({
        row: 2,
        price_from: null,
        exam_code: "?",
        deal: false,
        photos: ["cover.jpg", "back.jpg"],
      }),
      // With no price, an unreadable state is read as Coming Soon.
      expect.objectContaining({ row: 3, state: "coming-soon", format: "flash-cards" }),
      // With a price, as Live; and Shopee figures with one missing count as none.
      expect.objectContaining({ row: 4, state: "live", shopee: null }),
    ]);
  });
});

describe("parseSheet: missing headers", () => {
  it("names each missing header at row 1 and reads no rows", () => {
    const { rows, errors } = parseSheet(
      "variations",
      readCsv("product_slug,name\nce-formula-flash-cards,BUNDLE\n"),
    );

    expect(rows).toEqual([]);
    expect(errors).toEqual([
      { sheet: "variations", row: 1, column: "price", message: 'missing column "price"' },
      { sheet: "variations", row: 1, column: "order", message: 'missing column "order"' },
    ]);
  });
});

describe("parseSheet: reviews", () => {
  it("keeps a Review's text exactly as typed, line breaks and spaces included", () => {
    const text = " Suitability: Good\nSafe yung item 🫶🏻 ";
    const { rows, errors } = parseSheet(
      "reviews",
      csv("reviews", [{ product_slug: "me-cards", stars: "5", text, helpful: "", home_pin: "2" }]),
    );

    expect(errors).toEqual([]);
    expect(rows[0]?.data).toEqual({
      product_slug: "me-cards",
      stars: 5,
      text,
      variation: null,
      helpful: 0,
      home_pin: 2,
    });
  });

  it("reports stars 6 at its row and column", () => {
    const { errors } = parseSheet(
      "reviews",
      csv("reviews", [{ product_slug: "me-cards", stars: "6", text: "Good" }]),
    );

    expect(errors).toEqual([
      {
        sheet: "reviews",
        row: 2,
        column: "stars",
        message: "must be a whole number of stars from 1 to 5",
      },
    ]);
  });
});

describe("parseSheet: exams, subjects and variations", () => {
  it("reads an Exam with its code in uppercase", () => {
    const { rows } = parseSheet(
      "exams",
      csv("exams", [{ code: " ce ", board: "CELE", name: "Civil Engineering" }]),
    );

    expect(rows[0]?.data).toMatchObject({ code: "CE", board: "CELE", name: "Civil Engineering" });
  });

  it("reads a Subject's order and a variation's price", () => {
    const subjects = parseSheet(
      "subjects",
      csv("subjects", [{ exam_code: "CE", code: "MSTC", name: "Mathematics", order: "1" }]),
    );
    const variations = parseSheet(
      "variations",
      csv("variations", [
        { product_slug: "ce-cards", name: "MSTC ONLY", price: "₱400", order: "x" },
      ]),
    );

    expect(subjects.rows[0]?.data).toEqual({
      exam_code: "CE",
      code: "MSTC",
      name: "Mathematics",
      order: 1,
    });
    expect(variations.errors).toEqual([
      { sheet: "variations", row: 2, column: "order", message: '"x" is not a whole number' },
    ]);
  });
});
