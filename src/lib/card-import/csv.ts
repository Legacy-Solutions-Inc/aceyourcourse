import { CsvError, parse } from "csv-parse/sync";

import { MAX_CSV_BYTES } from "./limits";

// ─────────────────────────────────────────────────────────────────────────────
// Reading an import's CSV (spec, Phase 3 → Spreadsheet import): UTF-8 text
// whose first row is its headers, as Google Sheets and Excel download it.
// Only the file itself is judged here (empty, too big, not UTF-8 text, not
// CSV); the planner (plan.ts) judges its headers and rows. Mirrors the
// catalogue importer's readCsv (src/lib/catalogue-import/parse.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** A CSV as read: its headers (trimmed, lowercased) and its non-blank rows. */
export interface CsvSheet {
  headers: string[];
  /** Each row's cells as typed, numbered as the spreadsheet numbers it (the header is row 1). */
  rows: { row: number; cells: string[] }[];
}

export type CsvRead = { ok: true; sheet: CsvSheet } | { ok: false; problem: string };

const NOT_CSV = "isn’t a CSV file saved as UTF-8 text";

/** A control character no spreadsheet's CSV has: a sign of a binary file. */
const BINARY = /[\u0000-\u0008\u000E-\u001F]/;

/**
 * Pure: the file's headers and rows. Blank rows are skipped but still counted,
 * and a quoted cell with line breaks stays one row. Rows keep however many
 * cells they have, for the planner to judge.
 */
export function readCsvFile(bytes: Uint8Array): CsvRead {
  if (bytes.byteLength > MAX_CSV_BYTES) return { ok: false, problem: "is over 10 MB" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, problem: NOT_CSV };
  }
  if (BINARY.test(text)) return { ok: false, problem: NOT_CSV };

  let records: string[][];
  try {
    records = parse(text, { bom: true, relax_column_count: true });
  } catch (error) {
    if (error instanceof CsvError) {
      return { ok: false, problem: `can’t be read as CSV: ${error.message}` };
    }
    throw error;
  }

  const blank = (cells: string[]) => cells.every((cell) => cell.trim() === "");
  const headerIndex = records.findIndex((cells) => !blank(cells));
  if (headerIndex === -1) return { ok: false, problem: "is empty" };
  const header = records[headerIndex] ?? [];
  const rows = records.flatMap((cells, index) =>
    index <= headerIndex || blank(cells) ? [] : [{ row: index + 1, cells }],
  );
  return { ok: true, sheet: { headers: header.map((name) => name.trim().toLowerCase()), rows } };
}
