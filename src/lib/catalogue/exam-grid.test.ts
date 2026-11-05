import { describe, expect, it } from "vitest";

import { MAX_EXAMS } from "@/services/catalogue.schema";

import { examGridColumns, examGridTemplate } from "./exam-grid";

// The Website's grids of Exam tiles (ticket 23): built for 1–12 Exams, they
// show up to 6 in a row, then two balanced rows, and fewer on a narrow screen.

describe("examGridColumns", () => {
  it.each([
    [1, 1],
    [5, 5],
    [6, 6],
    [7, 4],
    [8, 4],
    [9, 5],
    [11, 6],
    [MAX_EXAMS, 6],
  ])("puts %i Exams in rows of at most %i", (count, columns) => {
    expect(examGridColumns(count)).toBe(columns);
  });

  it("gives an empty list one column", () => {
    expect(examGridColumns(0)).toBe(1);
  });
});

describe("examGridTemplate", () => {
  it("fills the row with the columns, never narrower than the smallest tile", () => {
    expect(examGridTemplate(5, { min: "9.5rem", gap: "0.625rem" })).toBe(
      "repeat(auto-fill, minmax(max(9.5rem, calc((100% - 4 * 0.625rem) / 5)), 1fr))",
    );
    expect(examGridTemplate(12, { min: "3.5rem", gap: "0.375rem" })).toBe(
      "repeat(auto-fill, minmax(max(3.5rem, calc((100% - 5 * 0.375rem) / 6)), 1fr))",
    );
  });
});
