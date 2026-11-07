import { describe, expect, it } from "vitest";

import {
  FieldError,
  isoDate,
  pesosToCentavos,
  pipeList,
  rating,
  readCsv,
  stars,
  wholeNumber,
  yesNo,
} from "./parse";

// The CSV reader and the cell parsers the catalogue import is built on. A cell
// the client typed wrongly throws a FieldError whose message tells them how to
// write it instead.

describe("readCsv", () => {
  it("reads the header and numbers each row as the spreadsheet does (header = row 1)", () => {
    const sheet = readCsv("slug,title\nce-cards,CE Cards\nme-cards,ME Cards\n");

    expect(sheet.headers).toEqual(["slug", "title"]);
    expect(sheet.rows).toEqual([
      { row: 2, cells: { slug: "ce-cards", title: "CE Cards" } },
      { row: 3, cells: { slug: "me-cards", title: "ME Cards" } },
    ]);
  });

  it("keeps a quoted cell's line breaks, commas and quotes, and counts it as one row", () => {
    const sheet = readCsv(
      'product_slug,text\nce-cards,"Readability: clear, minimalist.\nSays ""10/10"""\nme-cards,ok\n',
    );

    expect(sheet.rows).toEqual([
      {
        row: 2,
        cells: { product_slug: "ce-cards", text: 'Readability: clear, minimalist.\nSays "10/10"' },
      },
      { row: 3, cells: { product_slug: "me-cards", text: "ok" } },
    ]);
  });

  it("skips blank rows without renumbering the rows after them", () => {
    const sheet = readCsv("slug,title\nce-cards,CE\n,\nme-cards,ME\n");

    expect(sheet.rows.map((row) => row.row)).toEqual([2, 4]);
  });

  it("drops a byte-order mark and trims the headers", () => {
    const sheet = readCsv("﻿slug , title\nce-cards,CE\n");

    expect(sheet.headers).toEqual(["slug", "title"]);
  });

  it("reads a short row's missing cells as blank", () => {
    const sheet = readCsv("slug,title,size\nce-cards,CE\n");

    expect(sheet.rows[0]?.cells).toEqual({ slug: "ce-cards", title: "CE", size: "" });
  });

  it("rejects a CSV whose quotes don't close", () => {
    expect(() => readCsv('slug,title\nce-cards,"CE Cards\n')).toThrow(FieldError);
  });
});

describe("pesosToCentavos", () => {
  it.each([
    ["1200", 120000],
    ["₱1,249.50", 124950],
    ["1249.5", 124950],
    ["₱ 3,499", 349900],
    [" 699 ", 69900],
    ["0.05", 5],
  ])("reads %j as %i centavos", (pesos, centavos) => {
    expect(pesosToCentavos(pesos)).toBe(centavos);
  });

  it.each(["abc", "-5", "12.345", "1,2", "₱", "1.2.3"])("rejects %j", (pesos) => {
    expect(() => pesosToCentavos(pesos)).toThrow(
      `"${pesos}" is not a peso amount (write it like 1200 or ₱1,249.50)`,
    );
  });
});

describe("yesNo", () => {
  it.each([
    ["yes", true],
    ["No", false],
    [" YES ", true],
    // A Google Sheets checkbox downloads as TRUE or FALSE.
    ["TRUE", true],
    ["FALSE", false],
  ])("reads %j as %s", (value, expected) => {
    expect(yesNo(value)).toBe(expected);
  });

  it.each(["", "y", "maybe"])("rejects %j", (value) => {
    expect(() => yesNo(value)).toThrow(`must be yes or no, not "${value}"`);
  });
});

describe("pipeList", () => {
  it("splits on | and trims each item, keeping their order", () => {
    expect(pipeList(" CLIN CHEM | CLIN MIC & PARA|HEMA ")).toEqual([
      "CLIN CHEM",
      "CLIN MIC & PARA",
      "HEMA",
    ]);
  });

  it("reads a blank cell, and blank items, as nothing", () => {
    expect(pipeList("  ")).toEqual([]);
    expect(pipeList("cover.jpg||back.jpg|")).toEqual(["cover.jpg", "back.jpg"]);
  });
});

describe("isoDate", () => {
  it("reads a real YYYY-MM-DD date", () => {
    expect(isoDate(" 2026-10-29 ")).toBe("2026-10-29");
  });

  it.each(["2026-02-30", "29/10/2026", "2026-10-29T00:00"])("rejects %j", (value) => {
    expect(() => isoDate(value)).toThrow(`"${value}" is not a real date (write it as YYYY-MM-DD)`);
  });
});

describe("stars", () => {
  it.each([
    ["1", 1],
    [" 5 ", 5],
  ])("reads %j as %i", (value, expected) => {
    expect(stars(value)).toBe(expected);
  });

  it.each(["6", "0", "4.5", "five"])("rejects %j", (value) => {
    expect(() => stars(value)).toThrow("must be a whole number of stars from 1 to 5");
  });
});

describe("wholeNumber", () => {
  it.each([
    ["0", 0],
    ["764", 764],
    ["1,204", 1204],
  ])("reads %j as %i", (value, expected) => {
    expect(wholeNumber(value)).toBe(expected);
  });

  it.each(["-1", "2.5", "1.2k", "x"])("rejects %j", (value) => {
    expect(() => wholeNumber(value)).toThrow(`"${value}" is not a whole number`);
  });
});

describe("rating", () => {
  it.each([
    ["4.8", 4.8],
    ["5", 5],
  ])("reads %j as %d", (value, expected) => {
    expect(rating(value)).toBe(expected);
  });

  it.each(["4,8", "high", "-1"])("rejects %j", (value) => {
    expect(() => rating(value)).toThrow(`"${value}" is not a rating (write it like 4.8)`);
  });
});
