import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { SHEET_COLUMNS, type SheetName } from "@/lib/catalogue-import/rows";

// A small, valid catalogue spreadsheet for the import tests: one Exam, a Live
// and a Coming Soon Product, two variations and a Review. Tests edit a copy to
// make the problem they need.

export type SheetRecords = Record<SheetName, Record<string, string>[]>;

const VALID: SheetRecords = {
  exams: [
    {
      code: "CE",
      board: "CELE",
      name: "Civil Engineering",
      long_name: "Civil Engineering Licensure Exam",
      blurb: "Three subjects, four formats.",
      made_for: "Engineers needing a quick formula reference",
    },
  ],
  // Out of order on purpose: an Exam's Subjects follow their order column.
  subjects: [
    { exam_code: "CE", code: "PSAD", name: "Structural Analysis & Design", order: "3" },
    { exam_code: "CE", code: "MSTC", name: "Mathematics, Surveying & Transportation", order: "1" },
    { exam_code: "CE", code: "HPGE", name: "Hydraulics & Geotechnical", order: "2" },
  ],
  products: [
    {
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
      price_to: "₱1,249.50",
      shopee_url: "https://shopee.ph/ce-cards-i.1276620555.24292303887",
      lazada_url: "",
      tiktok_url: "",
      shopee_rating: "4.8",
      shopee_ratings: "197",
      units_sold: "764",
      figures_as_of: "2026-10-29",
      deal: "yes",
      available_in_app: "yes",
      show_on_website: "yes",
      whats_inside: "",
      made_for: "",
      seo_title: "",
      seo_description: "",
      photos: "/products/ce-formula-flash-cards/1.webp|/products/ce-formula-flash-cards/2.webp",
    },
    {
      slug: "ce-solving-notebook",
      exam_code: "CE",
      title: "Civil Engineering Solving Notebook",
      short_name: "CE Solving Notebook",
      format: "notebook",
      size: "A5",
      edition: "",
      subject_codes: "MSTC|HPGE|PSAD",
      state: "coming soon",
      price_from: "",
      price_to: "",
      shopee_url: "",
      lazada_url: "",
      tiktok_url: "",
      shopee_rating: "",
      shopee_ratings: "",
      units_sold: "",
      figures_as_of: "",
      deal: "no",
      available_in_app: "no",
      show_on_website: "yes",
      whats_inside: "",
      made_for: "",
      seo_title: "",
      seo_description: "",
      photos: "",
    },
  ],
  // Out of order on purpose: a Product's variations follow their order column.
  variations: [
    { product_slug: "ce-formula-flash-cards", name: "MSTC ONLY", price: "1249.5", order: "2" },
    { product_slug: "ce-formula-flash-cards", name: "BUNDLE", price: "1200", order: "1" },
  ],
  reviews: [
    {
      product_slug: "ce-formula-flash-cards",
      stars: "5",
      text: "Suitability: very useful\nQuality: clear, easy to read.",
      variation: "BUNDLE SECOND ED.",
      helpful: "8",
      home_pin: "1",
    },
  ],
};

/** The fixture spreadsheet's rows, edited by the test. */
export function sheetRecords(edit?: (sheets: SheetRecords) => void): SheetRecords {
  const sheets = structuredClone(VALID);
  edit?.(sheets);
  return sheets;
}

/** One sheet as Google Sheets downloads it: every header, then each row, every cell quoted. */
export function toCsv(sheet: SheetName, rows: Record<string, string>[]): string {
  const line = (cells: string[]) =>
    cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",");
  const headers = SHEET_COLUMNS[sheet];
  return [line(headers), ...rows.map((row) => line(headers.map((h) => row[h] ?? "")))].join("\n");
}

/** The fixture spreadsheet as CSV text per sheet, edited by the test. */
export function spreadsheet(edit?: (sheets: SheetRecords) => void): Record<SheetName, string> {
  const sheets = sheetRecords(edit);
  return {
    exams: toCsv("exams", sheets.exams),
    subjects: toCsv("subjects", sheets.subjects),
    products: toCsv("products", sheets.products),
    variations: toCsv("variations", sheets.variations),
    reviews: toCsv("reviews", sheets.reviews),
  };
}

/**
 * The hand-maintained part of the seed, with no FAQs or Exam pages, so the
 * fixture's Reviews and Products needn't match them.
 */
export const HAND_MAINTAINED = { settings: CATALOGUE_SEED.settings, faqs: [], examPages: [] };

/** A Product row of the fixture, by slug, for editing. */
export function productRow(sheets: SheetRecords, slug: string): Record<string, string> {
  const row = sheets.products.find((product) => product.slug === slug);
  if (!row) throw new Error(`no fixture Product "${slug}"`);
  return row;
}
