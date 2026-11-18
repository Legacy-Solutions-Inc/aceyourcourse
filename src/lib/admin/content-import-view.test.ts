import { describe, expect, it } from "vitest";

import type { ImportPreview } from "@/services/admin.types";

import {
  importContentLabel,
  importFileProblem,
  importProblemPlace,
  importTotals,
} from "./content-import-view";

// The import screen's pure view helpers (Phase 3, tickets 06 and 09), for
// cards and for quizzes.

const TOPIC = {
  name: "Highways",
  topicId: null,
  similarTo: null,
  content: "new",
  mode: "add",
  counts: { add: 2, replace: 0, keep: 0, remove: 0 },
} as const;

describe("importContentLabel", () => {
  it.each([
    ["cards", "new", "NEW DECK · HIDDEN"],
    ["cards", "hidden", "DECK · HIDDEN"],
    ["cards", "visible", "DECK · VISIBLE"],
    ["quizzes", "new", "NEW QUIZ · HIDDEN"],
    ["quizzes", "hidden", "QUIZ · HIDDEN"],
    ["quizzes", "visible", "QUIZ · VISIBLE"],
  ] as const)("names a %s import's %s deck or quiz", (kind, content, label) => {
    expect(importContentLabel(kind, content)).toBe(label);
  });
});

describe("importTotals", () => {
  const preview = (topics: ImportPreview["topics"]) => ({ topics });

  it("counts the cards the import saves and the Topics it creates", () => {
    expect(
      importTotals(
        "cards",
        preview([
          TOPIC,
          { ...TOPIC, name: "Statics" },
          {
            ...TOPIC,
            name: "Simple Curves",
            topicId: "t",
            content: "visible",
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
      content: "hidden" as const,
      counts: { ...TOPIC.counts, keep: 9 },
    };
    expect(importTotals("cards", preview([adding]))).toBe("2 cards in 1 Topic");
  });

  it("says one card and one Topic", () => {
    expect(
      importTotals("cards", preview([{ ...TOPIC, counts: { ...TOPIC.counts, add: 1 } }])),
    ).toBe("1 card in 1 Topic · 1 new Topic");
  });

  it("says when nothing would be imported", () => {
    expect(importTotals("cards", preview([]))).toBe("No cards to import");
    expect(importTotals("quizzes", preview([]))).toBe("No questions to import");
  });

  it("counts a quiz import's questions, and the questions Replace takes out", () => {
    const replacing = {
      ...TOPIC,
      topicId: "t",
      content: "visible" as const,
      mode: "replace" as const,
      counts: { add: 0, replace: 0, keep: 1, remove: 2 },
    };
    expect(importTotals("quizzes", preview([TOPIC, replacing]))).toBe(
      "3 questions in 2 Topics · 1 new Topic · 2 questions removed",
    );
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
    expect(importFileProblem(file("cards.csv", 100), "csv", "cards")).toBeNull();
    expect(importFileProblem(file("CARDS.CSV", 10 * 1024 * 1024), "csv", "cards")).toBeNull();
    expect(importFileProblem(file("images.zip", 200 * 1024 * 1024), "zip", "quizzes")).toBeNull();
  });

  it.each([
    [file("cards.xlsx", 100), "csv", "CHOOSE A .CSV FILE (IN SHEETS OR EXCEL: DOWNLOAD AS CSV)"],
    [file("images.rar", 100), "zip", "CHOOSE A .ZIP FILE OF IMAGES"],
    [file("cards.csv", 10 * 1024 * 1024 + 1), "csv", "KEEP THE CSV TO 10 MB"],
    [file("images.zip", 200 * 1024 * 1024 + 1), "zip", "KEEP THE ZIP TO 200 MB"],
    [file("cards.csv", 0), "csv", "THE FILE IS EMPTY"],
  ] as const)("refuses %o as the card import's %s", (chosen, kind, message) => {
    expect(importFileProblem(chosen, kind, "cards")).toBe(message);
  });

  it("asks a quiz import for a zip of figures", () => {
    expect(importFileProblem(file("figures.rar", 100), "zip", "quizzes")).toBe(
      "CHOOSE A .ZIP FILE OF FIGURES",
    );
  });
});
