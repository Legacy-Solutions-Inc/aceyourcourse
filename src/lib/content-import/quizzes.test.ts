import { describe, expect, it } from "vitest";

import { readCsvFile } from "./csv";
import type { ImportMode } from "./modes";
import type { TopicPlan } from "./plan";
import {
  type ExistingQuizTopic,
  planQuizImport,
  QUIZ_IMPORT_COLUMNS,
  type QuestionFields,
} from "./quizzes";
import type { ZipListing } from "./zip";

// The quiz import planner (Phase 3, ticket 09; spec, Phase 3 → Spreadsheet
// import; Testing Decisions → Pure modules; stories 119–124, 133l): the
// shared planner (plan.ts) reading quiz rows: each row error naming its row
// and column, Topics created after a rename, and Replace keeping the
// questions whose text is unchanged while the rest are marked removed.

const HEADER = QUIZ_IMPORT_COLUMNS.join(",");

/** The CSV's rows, under the template's header unless one is given. */
function csv(lines: string[], header = HEADER) {
  const read = readCsvFile(new TextEncoder().encode([header, ...lines].join("\n")));
  if (!read.ok) throw new Error(`The test CSV can't be read: ${read.problem}`);
  return read.sheet;
}

const zip = (...entries: [string, number][]): ZipListing => ({
  entries: entries.map(([name, size]) => ({ name, size })),
});

/** One row: a valid question unless cells are given, in the template's column order. */
function row(cells: Partial<Record<(typeof QUIZ_IMPORT_COLUMNS)[number], string>> = {}) {
  const values = {
    topic: "Simple Curves",
    question: "What is the degree of a 1145.916 m curve?",
    "choice a": "1°",
    "choice b": "2°",
    "choice c": "$\\frac{1}{2}$°",
    "choice d": "5°",
    "correct answer": "A",
    explanation: "$D = 1145.916 / R$",
    figure: "",
    ...cells,
  };
  return QUIZ_IMPORT_COLUMNS.map((column) => {
    const value = values[column];
    return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  }).join(",");
}

const question = (overrides: Partial<QuestionFields> = {}): QuestionFields => ({
  question: "What is the degree of a 1145.916 m curve?",
  choices: { A: "1°", B: "2°", C: "$\\frac{1}{2}$°", D: "5°" },
  correct: "A",
  explanation: "$D = 1145.916 / R$",
  ...overrides,
});

const SIMPLE_CURVES: ExistingQuizTopic = {
  id: "t-simple",
  name: "Simple Curves",
  content: { id: "q-simple", visibility: "visible" },
  items: [
    { id: "q1", image: null, ...question() },
    {
      id: "q2",
      image: null,
      ...question({ question: "Length of curve for I = 30°, D = 2°?", correct: "C" }),
    },
    { id: "q3", image: "quizzes/q-simple/old.png", ...question({ question: "Tangent distance?" }) },
  ],
};
const SURVEYING: ExistingQuizTopic = {
  id: "t-survey",
  name: "Surveying",
  content: null,
  items: [],
};
const TOPICS = [SIMPLE_CURVES, SURVEYING];

function plan(
  lines: string[],
  options: { header?: string; zip?: ZipListing | null; mode?: ImportMode } = {},
) {
  return planQuizImport({
    topics: TOPICS,
    csv: csv(lines, options.header),
    zip: options.zip ?? null,
    mode: options.mode ?? "add",
  });
}

const counts = (topic: TopicPlan<QuestionFields> | undefined) => topic?.counts;

describe("planQuizImport: a valid file", () => {
  it("plans each Topic's questions in the CSV's order, with the correct choice and figure", () => {
    const planned = plan(
      [
        row({ topic: "Highways", question: "Superelevation?", figure: "curve.png" }),
        row({ topic: "Highways", question: "Sight distance?", "correct answer": " d " }),
      ],
      { zip: zip(["figures/curve.png", 10]) },
    );

    expect(planned.problems).toEqual([]);
    expect(planned.topics.map((t) => [t.name, t.topicId, t.content])).toEqual([
      ["Highways", null, null],
    ]);
    expect(planned.topics[0]?.items).toEqual([
      {
        ...question({ question: "Superelevation?" }),
        row: 2,
        existingId: null,
        change: "add",
        image: "figures/curve.png",
      },
      {
        ...question({ question: "Sight distance?", correct: "D" }),
        row: 3,
        existingId: null,
        change: "add",
        image: null,
      },
    ]);
  });

  it("takes a lowercase correct answer, a literal \\$, and text at each field's limit", () => {
    const planned = plan([
      row({
        question: "q".repeat(1000),
        "choice a": "It costs \\$5",
        "choice d": "d".repeat(500),
        explanation: "e".repeat(2000),
        "correct answer": "b",
      }),
    ]);

    expect(planned.problems).toEqual([]);
    expect(planned.topics[0]?.items[0]).toMatchObject({
      correct: "B",
      choices: expect.objectContaining({ A: "It costs \\$5" }),
    });
  });

  it("matches existing Topics by name, and gives one without a quiz a new one", () => {
    const planned = plan([row({ topic: " surveying " }), row({ topic: "SIMPLE CURVES" })]);

    expect(planned.topics.map((t) => [t.name, t.topicId, t.content])).toEqual([
      ["Surveying", "t-survey", null],
      ["Simple Curves", "t-simple", { id: "q-simple", visibility: "visible" }],
    ]);
  });
});

describe("planQuizImport: row errors, each naming its row and column", () => {
  it.each([
    ["E", "is “E”: write A, B, C or D"],
    ["", "is blank: write the correct choice, A, B, C or D"],
    ["AB", "is “AB”: write A, B, C or D"],
    ["1", "is “1”: write A, B, C or D"],
  ])("a correct answer of %j", (answer, message) => {
    expect(plan([row({ "correct answer": answer })]).problems).toEqual([
      { file: "csv", row: 2, column: "correct answer", message },
    ]);
  });

  it.each(["choice a", "choice b", "choice c", "choice d"] as const)("a missing %s", (column) => {
    expect(plan([row({ [column]: "  " })]).problems).toEqual([
      { file: "csv", row: 2, column, message: "is blank: every question needs four choices" },
    ]);
  });

  it.each(["topic", "question", "explanation"] as const)("a blank %s", (column) => {
    expect(plan([row({ [column]: "" })]).problems).toEqual([
      { file: "csv", row: 2, column, message: "is blank" },
    ]);
  });

  it.each([
    ["question", "q".repeat(1001), "is 1,001 characters; keep it to 1,000"],
    ["choice b", "b".repeat(501), "is 501 characters; keep it to 500"],
    ["explanation", "e".repeat(2001), "is 2,001 characters; keep it to 2,000"],
  ] as const)("a %s over its limit", (column, value, message) => {
    expect(plan([row({ [column]: value })]).problems).toEqual([
      { file: "csv", row: 2, column, message },
    ]);
  });

  it.each(["question", "choice c", "explanation"] as const)(
    "a formula that won't render in the %s, without throwing",
    (column) => {
      expect(plan([row({ [column]: "Half is $\\frac{1}{$" })]).problems).toEqual([
        {
          file: "csv",
          row: 2,
          column,
          message:
            "has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
        },
      ]);
    },
  );

  it("a figure not in the zip", () => {
    expect(plan([row({ figure: "beam.png" })], { zip: zip(["truss.png", 10]) }).problems).toEqual([
      { file: "csv", row: 2, column: "figure", message: "“beam.png” isn’t in the zip" },
    ]);
  });

  it("a figure named with no zip chosen", () => {
    expect(plan([row({ figure: "beam.png" })]).problems).toEqual([
      {
        file: "csv",
        row: 2,
        column: "figure",
        message: "names “beam.png”, but no zip of figures was chosen",
      },
    ]);
  });

  it("a figure of the wrong type or over 5 MB", () => {
    const planned = plan([row({ figure: "beam.gif" }), row({ figure: "big.png" })], {
      zip: zip(["beam.gif", 10], ["big.png", 5 * 1024 * 1024 + 1]),
    });

    expect(planned.problems).toEqual([
      {
        file: "csv",
        row: 2,
        column: "figure",
        message: "“beam.gif” isn’t a JPEG, PNG or WebP image",
      },
      { file: "csv", row: 3, column: "figure", message: "“big.png” is over 5 MB" },
    ]);
  });

  it("reports every problem in a row, and leaves the row out of the plan", () => {
    const planned = plan([row({ "choice b": "", "correct answer": "E" }), row()]);

    expect(planned.problems).toEqual([
      {
        file: "csv",
        row: 2,
        column: "choice b",
        message: "is blank: every question needs four choices",
      },
      { file: "csv", row: 2, column: "correct answer", message: "is “E”: write A, B, C or D" },
    ]);
    expect(planned.topics[0]?.items.map((item) => item.row)).toEqual([3]);
  });
});

describe("planQuizImport: file errors", () => {
  it("a missing header", () => {
    const header = QUIZ_IMPORT_COLUMNS.filter((column) => column !== "correct answer").join(",");

    expect(plan(["a,b,c,d,e,f,g,h"], { header }).problems).toEqual([
      { file: "csv", row: 1, column: "correct answer", message: "is missing from the header row" },
    ]);
  });

  it("a card import's CSV, whose columns aren't a quiz's", () => {
    const planned = plan(["T,f,b,,"], { header: "topic,front,back,note,image" });

    expect(planned.topics).toEqual([]);
    expect(planned.problems).toContainEqual({
      file: "csv",
      row: 1,
      column: "front",
      message: `isn’t a column the template has (${QUIZ_IMPORT_COLUMNS.join(", ")})`,
    });
  });

  it("a CSV with no questions under its header", () => {
    expect(plan([]).problems).toEqual([
      {
        file: "csv",
        row: null,
        column: null,
        message: "has no questions: add one row per question under the header row",
      },
    ]);
  });
});

describe("planQuizImport: new Topics", () => {
  it("creates a Topic named after a renamed one, asking “did you rename it?”", () => {
    const planned = plan([row({ topic: "Simple Curve" })]);

    expect(planned.topics).toMatchObject([
      { name: "Simple Curve", topicId: null, similarTo: "Simple Curves", content: null },
    ]);
  });
});

describe("planQuizImport: re-importing a Topic that has questions", () => {
  const reimport = [
    // Unchanged.
    row(),
    // The same question with different spacing, and a corrected answer.
    row({ question: "  Length of curve   for I = 30°, D = 2°?", "correct answer": "B" }),
    // New.
    row({ question: "Middle ordinate?" }),
  ];

  it("Replace keeps the id of each question whose text is unchanged, and takes out the rest", () => {
    const planned = plan(reimport, { mode: "replace" });
    const topic = planned.topics[0];

    expect(planned.problems).toEqual([]);
    expect(topic?.mode).toBe("replace");
    expect(topic?.items.map((q) => [q.existingId, q.change, q.question, q.correct])).toEqual([
      ["q1", "keep", "What is the degree of a 1145.916 m curve?", "A"],
      ["q2", "replace", "Length of curve   for I = 30°, D = 2°?", "B"],
      [null, "add", "Middle ordinate?", "A"],
    ]);
    // Taken out, never deleted: the seam marks it removed, for old attempts.
    expect(topic?.removed).toEqual(["q3"]);
    expect(counts(topic)).toEqual({ add: 1, replace: 1, keep: 1, remove: 1 });
  });

  it("Replace counts a question with a changed choice, or a figure, as replaced", () => {
    const planned = plan(
      [row({ "choice d": "6°" }), row({ question: "Tangent distance?", figure: "t.png" })],
      { mode: "replace", zip: zip(["t.png", 10]) },
    );

    expect(planned.topics[0]?.items.map((q) => [q.existingId, q.change])).toEqual([
      ["q1", "replace"],
      ["q3", "replace"],
    ]);
  });

  it("Add appends every row after the existing questions, keeping them all", () => {
    const planned = plan(reimport, { mode: "add" });

    expect(planned.topics[0]?.items.map((q) => [q.existingId, q.change])).toEqual([
      [null, "add"],
      [null, "add"],
      [null, "add"],
    ]);
    expect(counts(planned.topics[0])).toEqual({ add: 3, replace: 0, keep: 3, remove: 0 });
  });
});
