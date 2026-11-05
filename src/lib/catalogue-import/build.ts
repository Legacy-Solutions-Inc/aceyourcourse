import { MARKETPLACES } from "@/content/website";
import { type CatalogueSeed, catalogueSeedSchema } from "@/services/catalogue.schema";
import type {
  Exam,
  Marketplace,
  Product,
  ProductVariation,
  Review,
  ShopeeFigures,
  Subject,
} from "@/services/catalogue.types";

import { FieldError, readCsv } from "./parse";
import { type PhotoJob, photoSrc } from "./photos";
import {
  type ExamRow,
  type ImportError,
  parseSheet,
  type ParsedSheet,
  type ProductRow,
  type ReviewRow,
  type SheetName,
  SHEETS,
  SHOPEE_FIGURES,
  type SubjectRow,
  type VariationRow,
} from "./rows";

// ─────────────────────────────────────────────────────────────────────────────
// Turns the spreadsheet's rows into the seed's Exams, Products and Reviews,
// then checks the whole seed with the seam's own validation (the same schema
// validateCatalogueSeed applies when the mock loads). Each seed record
// remembers the row it came from, so a validation error is reported at the
// sheet, row and column the client typed.
// ─────────────────────────────────────────────────────────────────────────────

/** The part of the seed the spreadsheet holds. */
export type GeneratedCatalogue = Pick<CatalogueSeed, "exams" | "products" | "reviews">;

/** The part kept by hand in code: Website settings, FAQs, Exam pages and Site pages. */
export type HandMaintained = Pick<CatalogueSeed, "settings" | "faqs" | "examPages" | "sitePages">;

export interface Conversion {
  catalogue: GeneratedCatalogue;
  photos: PhotoJob[];
  /** Sorted by sheet and row; empty when the spreadsheet is ready to import. */
  errors: ImportError[];
}

type ErrorLocation = Omit<ImportError, "message">;
type SeedPath = (string | number)[];

/** A problem with a whole sheet, or (sheet null) with the hand-maintained part of the seed. */
const sheetError = (sheet: SheetName | null, message: string): ImportError => ({
  sheet,
  row: null,
  column: null,
  message,
});

// Each seed field's spreadsheet column, for mapping a validation error back.
const EXAM_COLUMNS: Record<keyof Omit<Exam, "subjects">, keyof ExamRow> = {
  code: "code",
  board: "board",
  name: "name",
  longName: "long_name",
  blurb: "blurb",
  madeFor: "made_for",
};

const SUBJECT_COLUMNS: Record<keyof Subject, keyof SubjectRow> = { code: "code", name: "name" };

const PRODUCT_COLUMNS: Partial<Record<keyof Product, keyof ProductRow>> = {
  slug: "slug",
  examCode: "exam_code",
  title: "title",
  shortName: "short_name",
  format: "format",
  size: "size",
  edition: "edition",
  subjectCodes: "subject_codes",
  state: "state",
  priceFrom: "price_from",
  priceTo: "price_to",
  photos: "photos",
  deal: "deal",
  availableInApp: "available_in_app",
  showOnWebsite: "show_on_website",
  whatsInside: "whats_inside",
  madeFor: "made_for",
  seoTitle: "seo_title",
  seoDescription: "seo_description",
};

const [RATING, RATING_COUNT, UNITS_SOLD, AS_OF] = SHOPEE_FIGURES;
const SHOPEE_COLUMNS: Record<keyof ShopeeFigures, (typeof SHOPEE_FIGURES)[number]> = {
  rating: RATING,
  ratingCount: RATING_COUNT,
  unitsSold: UNITS_SOLD,
  asOf: AS_OF,
};

const VARIATION_COLUMNS: Record<keyof ProductVariation, keyof VariationRow> = {
  name: "name",
  price: "price",
};

const REVIEW_COLUMNS: Partial<Record<keyof Review, keyof ReviewRow>> = {
  productId: "product_slug",
  stars: "stars",
  text: "text",
  variation: "variation",
  helpful: "helpful",
  homePin: "home_pin",
};

const LISTING_COLUMNS: Record<Marketplace, "shopee_url" | "lazada_url" | "tiktok_url"> = {
  shopee: "shopee_url",
  lazada: "lazada_url",
  tiktok: "tiktok_url",
};

/** The column a seed field came from, if it came from one. */
function columnOf(columns: Partial<Record<string, string>>, field: unknown): string | null {
  return Object.entries(columns).find(([key]) => key === field)?.[1] ?? null;
}

/** Ids follow the row, so a problem in one row never renumbers the others. */
const idFor = (prefix: string, row: number) => `${prefix}-${String(row - 1).padStart(3, "0")}`;

/** Stable: equal orders keep their row order. */
const byOrder = <T extends { data: { order: number } }>(rows: T[]) =>
  [...rows].sort((a, b) => a.data.order - b.data.order);

interface Sheets {
  exams: ParsedSheet<ExamRow>;
  subjects: ParsedSheet<SubjectRow>;
  products: ParsedSheet<ProductRow>;
  variations: ParsedSheet<VariationRow>;
  reviews: ParsedSheet<ReviewRow>;
}

/** Pure: the seed records the rows describe, with each one's row, and the rows that refer to nothing. */
function build(sheets: Sheets) {
  const errors: ImportError[] = [];
  const reportUnknown = (location: ErrorLocation, message: string) =>
    errors.push({ ...location, message });

  // A duplicate code or slug is reported by seed validation. Only the first row
  // with it gets the Subjects, variations or Reviews, so they aren't reported again.
  const examCodes = new Set(sheets.exams.rows.map(({ data }) => data.code));
  const subjects = byOrder(sheets.subjects.rows);
  for (const { row, data } of subjects) {
    if (!examCodes.has(data.exam_code)) {
      reportUnknown(
        { sheet: "subjects", row, column: "exam_code" },
        `unknown Exam "${data.exam_code}"`,
      );
    }
  }
  const subjectsOf = (examIndex: number) => {
    const code = sheets.exams.rows[examIndex]?.data.code;
    const first = sheets.exams.rows.findIndex(({ data }) => data.code === code);
    return first === examIndex ? subjects.filter(({ data }) => data.exam_code === code) : [];
  };

  const exams: Exam[] = sheets.exams.rows.map(({ data }, examIndex) => ({
    code: data.code,
    board: data.board,
    name: data.name,
    longName: data.long_name,
    blurb: data.blurb,
    madeFor: data.made_for,
    subjects: subjectsOf(examIndex).map((subject) => ({
      code: subject.data.code,
      name: subject.data.name,
    })),
  }));

  const productSlugs = new Set(sheets.products.rows.map(({ data }) => data.slug));
  const variations = byOrder(sheets.variations.rows);
  for (const { row, data } of variations) {
    if (!productSlugs.has(data.product_slug)) {
      reportUnknown(
        { sheet: "variations", row, column: "product_slug" },
        `unknown Product "${data.product_slug}"`,
      );
    }
  }
  const firstWithSlug = (slug: string) =>
    sheets.products.rows.findIndex(({ data }) => data.slug === slug);
  const variationsOf = (productIndex: number) => {
    const slug = sheets.products.rows[productIndex]?.data.slug;
    if (slug === undefined || firstWithSlug(slug) !== productIndex) return [];
    return variations.filter(({ data }) => data.product_slug === slug);
  };

  const photos: PhotoJob[] = [];
  const products: Product[] = sheets.products.rows.map(({ row, data }, productIndex) => {
    const productPhotos = data.photos.map((ref, index) => {
      const src = photoSrc(data.slug, index + 1, ref);
      photos.push({ slug: data.slug, row, ref, src });
      return { src, alt: `${data.title}, photo ${index + 1} of ${data.photos.length}` };
    });
    const listings: Product["listings"] = {};
    for (const { id } of MARKETPLACES) {
      const url = data[LISTING_COLUMNS[id]];
      if (url !== null) listings[id] = url;
    }
    return {
      id: idFor("prd", row),
      slug: data.slug,
      examCode: data.exam_code,
      title: data.title,
      shortName: data.short_name,
      format: data.format,
      size: data.size,
      edition: data.edition,
      subjectCodes: data.subject_codes,
      state: data.state,
      priceFrom: data.price_from,
      priceTo: data.price_to,
      variations: variationsOf(productIndex).map((variation) => ({
        name: variation.data.name,
        price: variation.data.price,
      })),
      photos: productPhotos,
      listings,
      shopee: data.shopee,
      deal: data.deal,
      availableInApp: data.available_in_app,
      showOnWebsite: data.show_on_website,
      whatsInside: data.whats_inside,
      madeFor: data.made_for,
      seoTitle: data.seo_title,
      seoDescription: data.seo_description,
    };
  });

  const reviewRows: number[] = [];
  const reviews: Review[] = sheets.reviews.rows.flatMap(({ row, data }): Review[] => {
    const product = products[firstWithSlug(data.product_slug)];
    if (!product) {
      reportUnknown(
        { sheet: "reviews", row, column: "product_slug" },
        `unknown Product "${data.product_slug}"`,
      );
      return [];
    }
    reviewRows.push(row);
    return [
      {
        id: idFor("rev", row),
        productId: product.id,
        stars: data.stars,
        text: data.text,
        variation: data.variation,
        helpful: data.helpful,
        // The spreadsheet's Reviews are all copied from Shopee.
        marketplace: "shopee",
        homePin: data.home_pin,
      },
    ];
  });

  /** Where a seed field came from, or null for the hand-maintained part of the seed. */
  function locate(path: SeedPath): ErrorLocation | null {
    const [collection, index, field, ...rest] = path;
    if (typeof index !== "number") return null;

    if (collection === "exams") {
      if (field === "subjects" && typeof rest[0] === "number") {
        const subject = subjectsOf(index)[rest[0]];
        return {
          sheet: "subjects",
          row: subject?.row ?? null,
          column: columnOf(SUBJECT_COLUMNS, rest[1]),
        };
      }
      return {
        sheet: "exams",
        row: sheets.exams.rows[index]?.row ?? null,
        column: columnOf(EXAM_COLUMNS, field),
      };
    }

    if (collection === "products") {
      const product = sheets.products.rows[index];
      const row = product?.row ?? null;
      if (field === "variations") {
        const own = variationsOf(index);
        const [position, variationField] = rest;
        if (typeof position === "number") {
          return {
            sheet: "variations",
            row: own[position]?.row ?? null,
            column: columnOf(VARIATION_COLUMNS, variationField),
          };
        }
        // "Has no variations": point at the first one to remove.
        return { sheet: "variations", row: own[0]?.row ?? null, column: "product_slug" };
      }
      if (field === "listings") {
        // One Listing's link, or "has no Listings": point at the first one filled in.
        const listings = products[index]?.listings ?? {};
        const marketplace =
          MARKETPLACES.find(({ id }) => id === rest[0]) ??
          MARKETPLACES.find(({ id }) => listings[id] !== undefined);
        return {
          sheet: "products",
          row,
          column: marketplace ? LISTING_COLUMNS[marketplace.id] : null,
        };
      }
      if (field === "shopee") {
        return {
          sheet: "products",
          row,
          column: columnOf(SHOPEE_COLUMNS, rest[0]) ?? "shopee_rating",
        };
      }
      return { sheet: "products", row, column: columnOf(PRODUCT_COLUMNS, field) };
    }

    if (collection === "reviews") {
      return {
        sheet: "reviews",
        row: reviewRows[index] ?? null,
        column: columnOf(REVIEW_COLUMNS, field),
      };
    }
    return null;
  }

  return { catalogue: { exams, products, reviews }, photos, errors, locate };
}

const sheetOrder = (sheet: SheetName | null) =>
  sheet === null ? SHEETS.length : SHEETS.indexOf(sheet);

/** By sheet, then row; a whole-sheet problem first, the hand-maintained ones last. */
export function sortErrors(errors: ImportError[]): ImportError[] {
  return [...errors].sort(
    (a, b) => sheetOrder(a.sheet) - sheetOrder(b.sheet) || (a.row ?? 0) - (b.row ?? 0),
  );
}

/**
 * Pure: converts the spreadsheet (each sheet's CSV text, or null if it wasn't
 * sent) into the seed's Exams, Products and Reviews, and the photos they list.
 * The result is checked together with the hand-maintained settings, FAQs and
 * Exam pages, so an FAQ quote that no longer matches its Review, or a bundle
 * offer whose Product is gone, is caught too. Every
 * problem is reported, not only the first. A sheet that is missing, can't be
 * read or lacks a header stops the conversion there, since every row that
 * refers to it would fail too.
 */
export function convertSpreadsheet(
  csvs: Record<SheetName, string | null>,
  handMaintained: HandMaintained,
): Conversion {
  const errors: ImportError[] = [];
  const unread = { rows: [], errors: [] };
  function read<S extends SheetName>(sheet: S) {
    const csv = csvs[sheet];
    if (csv === null) {
      errors.push(sheetError(sheet, "isn't in the spreadsheet folder"));
      return unread;
    }
    try {
      const parsed = parseSheet(sheet, readCsv(csv));
      errors.push(...parsed.errors);
      return parsed;
    } catch (error) {
      if (!(error instanceof FieldError)) throw error;
      errors.push(sheetError(sheet, error.message));
      return unread;
    }
  }

  const sheets = {
    exams: read("exams"),
    subjects: read("subjects"),
    products: read("products"),
    variations: read("variations"),
    reviews: read("reviews"),
  };
  // A whole-sheet problem has no row, and a missing header is on row 1.
  if (errors.some((error) => error.row === null || error.row === 1)) {
    return {
      catalogue: { exams: [], products: [], reviews: [] },
      photos: [],
      errors: sortErrors(errors),
    };
  }

  const built = build(sheets);
  const found = [...built.errors];
  const validation = catalogueSeedSchema.safeParse({ ...handMaintained, ...built.catalogue });
  for (const issue of validation.error?.issues ?? []) {
    const location = built.locate(issue.path);
    found.push(
      location
        ? { ...location, message: issue.message }
        : sheetError(null, `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  // A cell that couldn't be read was built from a stand-in, so whatever else
  // is found at that cell is about the stand-in, not what the client typed.
  const at = ({ sheet, row, column }: ErrorLocation) => `${sheet} ${row} ${column}`;
  const unreadable = new Set(errors.map(at));
  errors.push(...found.filter((error) => !unreadable.has(at(error))));

  return { catalogue: built.catalogue, photos: built.photos, errors: sortErrors(errors) };
}
