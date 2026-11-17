import { describe, expect, it } from "vitest";

import { readCsvFile } from "./csv";
import { MAX_CSV_BYTES } from "./limits";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("readCsvFile", () => {
  it("reads the header row, lowercased and trimmed, and each row numbered as the spreadsheet numbers it", () => {
    const read = readCsvFile(bytes(" Topic ,FRONT,back\nStatics,Moment,$M = Fd$\n"));

    expect(read).toEqual({
      ok: true,
      sheet: {
        headers: ["topic", "front", "back"],
        rows: [{ row: 2, cells: ["Statics", "Moment", "$M = Fd$"] }],
      },
    });
  });

  it("skips blank rows but keeps counting them, and keeps a quoted cell with line breaks as one row", () => {
    const read = readCsvFile(bytes('topic,front\n\n,\nA,"one\ntwo"\nB,three\n'));

    expect(read.ok && read.sheet.rows).toEqual([
      { row: 4, cells: ["A", "one\ntwo"] },
      { row: 5, cells: ["B", "three"] },
    ]);
  });

  it("reads a UTF-8 file saved with a byte order mark, as Excel saves it", () => {
    const read = readCsvFile(bytes("﻿topic,front\nÁlgebra,π\n"));

    expect(read.ok && read.sheet).toEqual({
      headers: ["topic", "front"],
      rows: [{ row: 2, cells: ["Álgebra", "π"] }],
    });
  });

  it("keeps rows with more or fewer cells than the header, for the planner to judge", () => {
    const read = readCsvFile(bytes("topic,front\nA\nB,c,d\n"));

    expect(read.ok && read.sheet.rows).toEqual([
      { row: 2, cells: ["A"] },
      { row: 3, cells: ["B", "c", "d"] },
    ]);
  });

  it("refuses an empty file", () => {
    expect(readCsvFile(new Uint8Array())).toEqual({ ok: false, problem: "is empty" });
    expect(readCsvFile(bytes("\n\n"))).toEqual({ ok: false, problem: "is empty" });
  });

  it("refuses a file that isn't UTF-8 text, such as a spreadsheet saved as .xlsx", () => {
    // An .xlsx file is a zip: it starts "PK", then bytes that aren't UTF-8.
    const xlsx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0xff, 0xfe]);
    expect(readCsvFile(xlsx)).toEqual({
      ok: false,
      problem: "isn’t a CSV file saved as UTF-8 text",
    });
  });

  it("refuses a binary file that happens to be valid UTF-8", () => {
    expect(readCsvFile(bytes("topic,front\u0000\u0001\nA,b"))).toEqual({
      ok: false,
      problem: "isn’t a CSV file saved as UTF-8 text",
    });
  });

  it("refuses a file csv-parse can't read, saying why", () => {
    const read = readCsvFile(bytes('topic,front\nA,"never closed\n'));

    expect(read.ok).toBe(false);
    expect(!read.ok && read.problem).toMatch(/^can’t be read as CSV: /);
  });

  it(`refuses a file over ${MAX_CSV_BYTES / 1024 / 1024} MB`, () => {
    expect(readCsvFile(new Uint8Array(MAX_CSV_BYTES + 1))).toEqual({
      ok: false,
      problem: "is over 10 MB",
    });
  });
});
