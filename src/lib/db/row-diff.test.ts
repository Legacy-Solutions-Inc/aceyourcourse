import { describe, expect, it } from "vitest";

import { diffRows } from "./row-diff";

// The database arm of the Admin seam writes only what a save changed: the rows
// to delete, insert and update between a table's rows before and after.

type Row = { id: string; position: number; name: string | null; at?: Date | null };
const byId = (row: Row) => row.id;

describe("diffRows", () => {
  it("finds nothing to write when the rows are the same, in any order", () => {
    const rows: Row[] = [
      { id: "a", position: 0, name: "A" },
      { id: "b", position: 1, name: "B" },
    ];
    expect(diffRows(rows, [...rows].reverse(), byId)).toEqual({
      deleted: [],
      inserted: [],
      updated: [],
    });
  });

  it("deletes the rows that are gone and inserts the new ones", () => {
    const before: Row[] = [
      { id: "a", position: 0, name: "A" },
      { id: "b", position: 1, name: "B" },
    ];
    const after: Row[] = [
      { id: "a", position: 0, name: "A" },
      { id: "c", position: 1, name: "C" },
    ];
    expect(diffRows(before, after, byId)).toEqual({
      deleted: [{ id: "b", position: 1, name: "B" }],
      inserted: [{ id: "c", position: 1, name: "C" }],
      updated: [],
    });
  });

  it("updates a row whose key stays but whose values change, with the whole row", () => {
    const before: Row[] = [{ id: "a", position: 0, name: "A" }];
    const after: Row[] = [{ id: "a", position: 3, name: "A" }];
    expect(diffRows(before, after, byId).updated).toEqual([{ id: "a", position: 3, name: "A" }]);
  });

  it("compares times by their value, not their object", () => {
    const before: Row[] = [
      { id: "a", position: 0, name: null, at: new Date("2026-11-03T00:00:00Z") },
    ];
    const after: Row[] = [
      { id: "a", position: 0, name: null, at: new Date("2026-11-03T00:00:00Z") },
    ];
    expect(diffRows(before, after, byId).updated).toEqual([]);
  });

  it("reads a missing value as null, and writes it as null so the column is cleared", () => {
    const before: Row[] = [{ id: "a", position: 0, name: "A", at: null }];
    const unchanged: Row[] = [{ id: "a", position: 0, name: "A" }];
    expect(diffRows(before, unchanged, byId).updated).toEqual([]);

    const cleared = [{ id: "a", position: 0, name: undefined }] as unknown as Row[];
    expect(diffRows(before, cleared, byId).updated).toEqual([{ id: "a", position: 0, name: null }]);
  });

  it("ignores a column only the database has, such as an identity", () => {
    const before = [{ id: "a", position: 0, name: "A", seq: 7 }];
    const after: Row[] = [{ id: "a", position: 0, name: "A" }];
    expect(diffRows(before, after, byId).updated).toEqual([]);
  });

  it("compares arrays by their items", () => {
    const before = [{ id: "a", tags: ["x", "y"] }];
    expect(diffRows(before, [{ id: "a", tags: ["x", "y"] }], (row) => row.id).updated).toEqual([]);
    expect(diffRows(before, [{ id: "a", tags: ["y", "x"] }], (row) => row.id).updated).toEqual([
      { id: "a", tags: ["y", "x"] },
    ]);
  });

  it("refuses rows with the same key twice, which no table could hold", () => {
    const twice: Row[] = [
      { id: "a", position: 0, name: "A" },
      { id: "a", position: 1, name: "A" },
    ];
    expect(() => diffRows([], twice, byId)).toThrow('Two rows have the key "a".');
  });
});
