import { CsvError, parse } from "csv-parse/sync";

import { isCalendarDate } from "@/lib/manila-time";
import type { Review } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Reading the client's catalogue spreadsheet: one CSV per tab, downloaded from
// Google Sheets, and the parsers for the cells they type by hand. A cell that
// can't be read throws a FieldError whose message says how to write it, and
// the row schemas (rows.ts) attach the sheet, row and column.
// ─────────────────────────────────────────────────────────────────────────────

/** A cell, or a whole CSV, that can't be read as typed. */
export class FieldError extends Error {}

/** A spreadsheet row: its number as the spreadsheet shows it, and its cells by header. */
export interface SheetRow {
  row: number;
  cells: Record<string, string>;
}

export interface Sheet {
  headers: string[];
  rows: SheetRow[];
}

/**
 * Pure: reads a CSV whose first row is its headers. Rows are numbered as in the
 * spreadsheet (the header is row 1), so a quoted cell with line breaks is still
 * one row. Blank rows are skipped but still counted. Cells are kept exactly as
 * typed: each parser trims what it reads, and a Review's text is never changed.
 */
export function readCsv(text: string): Sheet {
  let records: string[][];
  try {
    records = parse(text, { bom: true, relax_column_count: true });
  } catch (error) {
    if (error instanceof CsvError) throw new FieldError(`can't be read as CSV: ${error.message}`);
    throw error;
  }

  const [header = [], ...body] = records;
  const headers = header.map((name) => name.trim());
  const rows = body.flatMap((cells, index): SheetRow[] => {
    if (cells.every((cell) => cell.trim() === "")) return [];
    const byHeader = Object.fromEntries(headers.map((name, column) => [name, cells[column] ?? ""]));
    return [{ row: index + 2, cells: byHeader }];
  });
  return { headers, rows };
}

/** Digits, with or without thousands commas: "1204", "1,204". */
const WHOLE = String.raw`(\d{1,3}(?:,\d{3})+|\d+)`;

/** "1,249.50": a whole number of pesos, then up to two decimals. */
const PESOS = new RegExp(String.raw`^${WHOLE}(?:\.(\d{1,2}))?$`);

const WHOLE_NUMBER = new RegExp(`^${WHOLE}$`);

/** Pure: a peso amount as typed ("1200", "₱1,249.50", "1249.5") in integer centavos. */
export function pesosToCentavos(value: string): number {
  const match = PESOS.exec(value.replace("₱", "").trim());
  if (!match) {
    throw new FieldError(`"${value}" is not a peso amount (write it like 1200 or ₱1,249.50)`);
  }
  const [, pesos = "", fraction = ""] = match;
  return Number(pesos.replaceAll(",", "")) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Pure: yes or no, in any case. A Google Sheets checkbox downloads as TRUE or FALSE. */
export function yesNo(value: string): boolean {
  const answer = value.trim().toLowerCase();
  if (answer === "yes" || answer === "true") return true;
  if (answer === "no" || answer === "false") return false;
  throw new FieldError(`must be yes or no, not "${value}"`);
}

/** Pure: a cell listing several values separated by |, in order. A blank cell lists none. */
export function pipeList(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

/** Pure: a YYYY-MM-DD date that is on the calendar ("2026-02-30" is not). */
export function isoDate(value: string): string {
  const date = value.trim();
  if (!isCalendarDate(date)) {
    throw new FieldError(`"${value}" is not a real date (write it as YYYY-MM-DD)`);
  }
  return date;
}

/** Pure: a Review's stars, a whole number from 1 to 5. */
export function stars(value: string): Review["stars"] {
  switch (value.trim()) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
    default:
      throw new FieldError("must be a whole number of stars from 1 to 5");
  }
}

/** Pure: a count such as units sold, with optional thousands commas ("1,204"). */
export function wholeNumber(value: string): number {
  const digits = value.trim();
  if (!WHOLE_NUMBER.test(digits)) {
    throw new FieldError(`"${value}" is not a whole number`);
  }
  return Number(digits.replaceAll(",", ""));
}

/** Pure: a Shopee star rating such as 4.8. */
export function rating(value: string): number {
  const digits = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(digits)) {
    throw new FieldError(`"${value}" is not a rating (write it like 4.8)`);
  }
  return Number(digits);
}
