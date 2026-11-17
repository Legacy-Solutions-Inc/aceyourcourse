import { describe, expect, it } from "vitest";

import type { CardImportPreview } from "@/services/admin.types";

import {
  importDeckLabel,
  importFileProblem,
  importProblemPlace,
  importTotals,
} from "./card-import-view";

// The card import screen's pure view helpers (Phase 3, ticket 06).

const TOPIC = {
  name: "Highways",
  topicId: null,
  similarTo: null,
  deck: "new",
  mode: "add",
  counts: { add: 2, replace: 0, keep: 0, remove: 0 },
} as const;

describe("importDeckLabel", () => {
  it.each([
    ["new", "NEW DECK · HIDDEN"],
    ["hidden", "DECK · HIDDEN"],
    ["visible", "DECK · VISIBLE"],
  ] as const)("names a %s deck", (deck, label) => {
    expect(importDeckLabel(deck)).toBe(label);
  });
});

describe("importTotals", () => {
  const preview = (topics: CardImportPreview["topics"]) => ({ topics });

  it("counts the cards the import saves and the Topics it creates", () => {
    expect(
      importTotals(
        preview([
          TOPIC,
          { ...TOPIC, name: "Statics" },
          {
            ...TOPIC,
            name: "Simple Curves",
            topicId: "t",
            deck: "visible",
            mode: "replace",
            counts: { add: 1, replace: 2, keep: 3, remove: 4 },
          },
        ]),
      ),
    ).toBe("10 cards in 3 Topics · 2 new Topics · 4 cards removed");
  });

  it("counts the file's cards, not the cards Add keeps", () => {
    const adding = {
      ...TOPIC,
      topicId: "t",
      deck: "hidden" as const,
      counts: { ...TOPIC.counts, keep: 9 },
    };
    expect(importTotals(preview([adding]))).toBe("2 cards in 1 Topic");
  });

  it("says one card and one Topic", () => {
    expect(importTotals(preview([{ ...TOPIC, counts: { ...TOPIC.counts, add: 1 } }]))).toBe(
      "1 card in 1 Topic · 1 new Topic",
    );
  });

  it("says when nothing would be imported", () => {
    expect(importTotals(preview([]))).toBe("No cards to import");
  });
});

describe("importProblemPlace", () => {
  it.each([
    [{ file: "csv", row: 4, column: "back" }, "CSV · ROW 4 · BACK"],
    [{ file: "csv", row: 1, column: "note" }, "CSV · HEADER ROW · NOTE"],
    [{ file: "csv", row: 7, column: null }, "CSV · ROW 7"],
    [{ file: "csv", row: null, column: null }, "CSV"],
    [{ file: "zip", row: null, column: null }, "ZIP"],
  ] as const)("names where %o is", (problem, place) => {
    expect(importProblemPlace({ ...problem, message: "x" })).toBe(place);
  });
});

describe("importFileProblem", () => {
  const file = (name: string, size: number) => ({ name, size });

  it("takes a CSV and a zip within their limits", () => {
    expect(importFileProblem(file("cards.csv", 100), "csv")).toBeNull();
    expect(importFileProblem(file("CARDS.CSV", 10 * 1024 * 1024), "csv")).toBeNull();
    expect(importFileProblem(file("images.zip", 200 * 1024 * 1024), "zip")).toBeNull();
  });

  it.each([
    [file("cards.xlsx", 100), "csv", "CHOOSE A .CSV FILE (IN SHEETS OR EXCEL: DOWNLOAD AS CSV)"],
    [file("images.rar", 100), "zip", "CHOOSE A .ZIP FILE OF IMAGES"],
    [file("cards.csv", 10 * 1024 * 1024 + 1), "csv", "KEEP THE CSV TO 10 MB"],
    [file("images.zip", 200 * 1024 * 1024 + 1), "zip", "KEEP THE ZIP TO 200 MB"],
    [file("cards.csv", 0), "csv", "THE FILE IS EMPTY"],
  ] as const)("refuses %o as the %s", (chosen, kind, message) => {
    expect(importFileProblem(chosen, kind)).toBe(message);
  });
});
