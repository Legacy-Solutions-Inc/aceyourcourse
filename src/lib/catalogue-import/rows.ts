import { z } from "zod";

import type { ProductFormat, ProductState } from "@/services/catalogue.types";

import {
  FieldError,
  isoDate,
  pesosToCentavos,
  pipeList,
  rating,
  type Sheet,
  stars,
  wholeNumber,
  yesNo,
} from "./parse";

// ─────────────────────────────────────────────────────────────────────────────
// One row schema per sheet of the catalogue spreadsheet. They only read cells:
// the spreadsheet's words ("flash cards", "coming soon", yes/no, pesos) become
// the seed's values. The catalogue rules themselves (a Live Product needs a
// price, a Coming Soon one has none, …) stay in validateCatalogueSeed, which
// checks the built seed. Every error names its sheet, row and column.
// ─────────────────────────────────────────────────────────────────────────────

export const SHEETS = ["exams", "subjects", "products", "variations", "reviews"] as const;
export type SheetName = (typeof SHEETS)[number];

/**
 * A problem with the spreadsheet, where the client can find it: the sheet, its
 * row (the header is row 1) and the column. A problem with the hand-maintained
 * settings or FAQs has no sheet.
 */
export interface ImportError {
  sheet: SheetName | null;
  row: number | null;
  column: string | null;
  message: string;
}

/** A sheet row read into values, with its spreadsheet row number. */
export interface Parsed<T> {
  row: number;
  data: T;
}

/** A cell read by a parser. A FieldError becomes an issue at that cell's column. */
function cell<T>(parser: (value: string) => T) {
  return z.string().transform((value, ctx): T => {
    try {
      return parser(value);
    } catch (error) {
      if (!(error instanceof FieldError)) throw error;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.message });
      return z.NEVER;
    }
  });
}

/** A cell that may be left blank, read as null. */
const optional = <T>(parser: (value: string) => T) =>
  cell((value) => (value.trim() === "" ? null : parser(value)));

const text = cell((value) => value.trim());
const optionalText = optional((value) => value.trim());

/** A cell other rows refer to by its value, so it can't be blank. */
const key = cell((value) => {
  if (value.trim() === "") throw new FieldError("must not be blank");
  return value.trim();
});

/** Exam codes are uppercase in the seed, so "ce" reads as "CE". */
const examCode = key.transform((code) => code.toUpperCase());

/** The spreadsheet's words for a value, in any case. */
function oneOf<T>(words: Map<string, T>) {
  const allowed = [...words.keys()];
  const list = `${allowed.slice(0, -1).join(", ")} or ${allowed.at(-1)}`;
  return cell((value) => {
    const found = words.get(value.trim().toLowerCase());
    if (found === undefined) throw new FieldError(`must be ${list}, not "${value}"`);
    return found;
  });
}

const format = oneOf(
  new Map<string, ProductFormat>([
    ["flash cards", "flash-cards"],
    ["notebook", "notebook"],
    ["posters", "posters"],
    ["bundle", "bundle"],
  ]),
);

const state = oneOf(
  new Map<string, ProductState>([
    ["live", "live"],
    ["coming soon", "coming-soon"],
  ]),
);

const examColumns = {
  code: examCode,
  board: text,
  name: text,
  long_name: text,
  blurb: text,
  made_for: text,
};

const subjectColumns = {
  exam_code: examCode,
  code: text,
  name: text,
  order: cell(wholeNumber),
};

const productColumns = {
  slug: text,
  exam_code: examCode,
  title: text,
  short_name: text,
  format,
  size: text,
  edition: optionalText,
  subject_codes: cell(pipeList),
  state,
  price_from: optional(pesosToCentavos),
  price_to: optional(pesosToCentavos),
  shopee_url: optionalText,
  lazada_url: optionalText,
  tiktok_url: optionalText,
  shopee_rating: optional(rating),
  shopee_ratings: optional(wholeNumber),
  units_sold: optional(wholeNumber),
  figures_as_of: optional(isoDate),
  deal: cell(yesNo),
  available_in_app: cell(yesNo),
  show_on_website: cell(yesNo),
  whats_inside: optionalText,
  made_for: optional(pipeList),
  seo_title: optionalText,
  seo_description: optionalText,
  photos: cell(pipeList),
};

const variationColumns = {
  product_slug: key,
  name: text,
  price: cell(pesosToCentavos),
  order: cell(wholeNumber),
};

const reviewColumns = {
  product_slug: key,
  stars: cell(stars),
  // Copied word for word, so kept exactly as typed.
  text: z.string(),
  variation: optionalText,
  helpful: cell((value) => (value.trim() === "" ? 0 : wholeNumber(value))),
  home_pin: optional(wholeNumber),
};

/** The four Shopee figures go together: all filled in, or none. */
export const SHOPEE_FIGURES = [
  "shopee_rating",
  "shopee_ratings",
  "units_sold",
  "figures_as_of",
] as const;

const productCells = z.object(productColumns);
type ProductCells = z.output<typeof productCells>;

function withShopeeFigures({
  shopee_rating,
  shopee_ratings,
  units_sold,
  figures_as_of,
  ...row
}: ProductCells) {
  return {
    ...row,
    shopee:
      shopee_rating === null ||
      shopee_ratings === null ||
      units_sold === null ||
      figures_as_of === null
        ? null
        : {
            rating: shopee_rating,
            ratingCount: shopee_ratings,
            unitsSold: units_sold,
            asOf: figures_as_of,
          },
  };
}

const productRow = productCells
  .superRefine((row, ctx) => {
    const blank = SHOPEE_FIGURES.filter((column) => row[column] === null);
    if (blank.length === 0 || blank.length === SHOPEE_FIGURES.length) return;
    blank.forEach((column) =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [column],
        message: `fill in all four Shopee figures (${SHOPEE_FIGURES.join(", ")}), or leave all four blank`,
      }),
    );
  })
  .transform(withShopeeFigures);

const examRow = z.object(examColumns);
const subjectRow = z.object(subjectColumns);
const variationRow = z.object(variationColumns);
const reviewRow = z.object(reviewColumns);

export type ExamRow = z.output<typeof examRow>;
export type SubjectRow = z.output<typeof subjectRow>;
export type ProductRow = z.output<typeof productRow>;
export type VariationRow = z.output<typeof variationRow>;
export type ReviewRow = z.output<typeof reviewRow>;

interface SheetRows {
  exams: ExamRow;
  subjects: SubjectRow;
  products: ProductRow;
  variations: VariationRow;
  reviews: ReviewRow;
}

type RowSchemas = { [S in SheetName]: z.ZodType<SheetRows[S], z.ZodTypeDef, unknown> };

const ROW_SCHEMAS: RowSchemas = {
  exams: examRow,
  subjects: subjectRow,
  products: productRow,
  variations: variationRow,
  reviews: reviewRow,
};

/** The same, without the rules that span cells: for building a row whose problems are already reported. */
const LENIENT_ROW_SCHEMAS: RowSchemas = {
  ...ROW_SCHEMAS,
  products: productCells.transform(withShopeeFigures),
};

/** Each sheet's headers, in the template's order. Every one must be present. */
export const SHEET_COLUMNS: Record<SheetName, string[]> = {
  exams: Object.keys(examColumns),
  subjects: Object.keys(subjectColumns),
  products: Object.keys(productColumns),
  variations: Object.keys(variationColumns),
  reviews: Object.keys(reviewColumns),
};

/**
 * What a cell that can't be read is taken to say, so the rest of its row is
 * still built and checked: blank, unless blank can't be read either. The cell
 * itself is already reported, so convertSpreadsheet drops any later error at
 * it rather than report the stand-in.
 */
const STAND_INS: Record<SheetName, Record<string, (cells: Record<string, string>) => string>> = {
  exams: { code: () => "?" },
  subjects: { exam_code: () => "?", order: () => "0" },
  products: {
    exam_code: () => "?",
    format: () => "flash cards",
    // Its price says which rules (Live or Coming Soon) it is likelier meant for.
    state: (cells) => (cells.price_from?.trim() ? "live" : "coming soon"),
    deal: () => "no",
    available_in_app: () => "no",
    show_on_website: () => "yes",
  },
  variations: { product_slug: () => "?", price: () => "0", order: () => "0" },
  reviews: { product_slug: () => "?", stars: () => "5" },
};

export interface ParsedSheet<T> {
  /** Every row, a row with unreadable cells built from their stand-ins. */
  rows: Parsed<T>[];
  /** One per cell that can't be read, and per missing header. */
  errors: ImportError[];
}

/**
 * Pure: reads every row of a sheet, with an error for each cell that can't be
 * read. Such a row is still built, from stand-ins for those cells, so its
 * other cells go on to be checked in the same run. A sheet missing a header
 * reads no rows, since every one of them would fail.
 */
export function parseSheet<S extends SheetName>(sheet: S, csv: Sheet): ParsedSheet<SheetRows[S]> {
  const missing = SHEET_COLUMNS[sheet].filter((column) => !csv.headers.includes(column));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: missing.map((column) => ({
        sheet,
        row: 1,
        column,
        message: `missing column "${column}"`,
      })),
    };
  }

  const rows: Parsed<SheetRows[S]>[] = [];
  const errors: ImportError[] = [];
  for (const { row, cells } of csv.rows) {
    const result = ROW_SCHEMAS[sheet].safeParse(cells);
    if (result.success) {
      rows.push({ row, data: result.data });
      continue;
    }
    const standIns: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const column = String(issue.path[0] ?? "");
      errors.push({ sheet, row, column: column || null, message: issue.message });
      const standIn = STAND_INS[sheet][column];
      standIns[column] = standIn ? standIn(cells) : "";
    }
    const rebuilt = LENIENT_ROW_SCHEMAS[sheet].safeParse({ ...cells, ...standIns });
    if (rebuilt.success) rows.push({ row, data: rebuilt.data });
  }
  return { rows, errors };
}
