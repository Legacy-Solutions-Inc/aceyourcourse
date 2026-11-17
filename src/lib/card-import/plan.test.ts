import { describe, expect, it } from "vitest";

import { readCsvFile } from "./csv";
import type { ImportMode } from "./modes";
import { type ExistingTopic, MAX_IMPORT_ROWS, planCardImport, type TopicPlan } from "./plan";
import type { ZipListing } from "./zip";

// The card import planner (spec, Phase 3 → Spreadsheet import; Testing
// Decisions → Pure modules): the CSV's rows, the zip's listing and the
// Subject's Topics in, the preview out: the Topics to create, the cards to
// add, replace, keep or remove per Topic, and every problem, each naming the
// file, row and column.

const HEADER = "topic,front,back,note,image";

/** The CSV's rows, under the template's header unless one is given. */
function csv(lines: string[], header = HEADER) {
  const read = readCsvFile(new TextEncoder().encode([header, ...lines].join("\n")));
  if (!read.ok) throw new Error(`The test CSV can't be read: ${read.problem}`);
  return read.sheet;
}

const zip = (...entries: [string, number][]): ZipListing => ({
  entries: entries.map(([name, size]) => ({ name, size })),
});

const SIMPLE_CURVES: ExistingTopic = {
  id: "t-simple",
  name: "Simple Curves",
  deck: { id: "d-simple", visibility: "visible" },
  cards: [
    { id: "c-degree", front: "Degree of curve", back: "$D = 1145.916/R$", note: null, image: null },
    { id: "c-length", front: "Length of curve", back: "$L = 20I/D$", note: null, image: null },
    {
      id: "c-tangent",
      front: "Tangent distance",
      back: "$T = R\\tan(I/2)$",
      note: null,
      image: null,
    },
  ],
};
const SURVEYING: ExistingTopic = { id: "t-survey", name: "Surveying", deck: null, cards: [] };
const ALGEBRA: ExistingTopic = {
  id: "t-algebra",
  name: "Algebra",
  deck: { id: "d-algebra", visibility: "hidden" },
  cards: [],
};
const TOPICS = [SIMPLE_CURVES, SURVEYING, ALGEBRA];

function plan(
  lines: string[],
  options: {
    header?: string;
    zip?: ZipListing | null;
    topics?: ExistingTopic[];
    mode?: ImportMode;
  } = {},
) {
  return planCardImport({
    topics: options.topics ?? TOPICS,
    csv: csv(lines, options.header),
    zip: options.zip ?? null,
    mode: options.mode ?? "add",
  });
}

const counts = (topic: TopicPlan | undefined) => topic?.counts;

describe("planCardImport: a valid file", () => {
  it("plans each Topic in order of first appearance, with its cards in the CSV's order", () => {
    const planned = plan(
      [
        "Statics,Moment,$M = Fd$,,",
        "Surveying,Bearing,An angle from north or south,,",
        "Statics,Couple,Two equal and opposite forces,A note,",
      ],
      { zip: null },
    );

    expect(planned.problems).toEqual([]);
    expect(planned.topics.map((t) => [t.name, t.topicId])).toEqual([
      ["Statics", null],
      ["Surveying", "t-survey"],
    ]);
    expect(planned.topics[0]?.cards).toEqual([
      {
        row: 2,
        cardId: null,
        change: "add",
        front: "Moment",
        back: "$M = Fd$",
        note: null,
        image: null,
      },
      {
        row: 4,
        cardId: null,
        change: "add",
        front: "Couple",
        back: "Two equal and opposite forces",
        note: "A note",
        image: null,
      },
    ]);
  });

  it("trims each cell, and reads a blank note or image as none", () => {
    const planned = plan(["  Statics ,  Moment  ,  $M$  ,   ,   "]);

    expect(planned.problems).toEqual([]);
    expect(planned.topics[0]?.cards[0]).toMatchObject({
      front: "Moment",
      back: "$M$",
      note: null,
      image: null,
    });
  });

  it("matches existing Topics by name, ignoring case and extra spaces", () => {
    const planned = plan(["  simple   CURVES ,Superelevation,$e = v^2/gR$,,"]);

    expect(planned.topics).toHaveLength(1);
    expect(planned.topics[0]).toMatchObject({
      name: "Simple Curves",
      topicId: "t-simple",
      deck: { id: "d-simple", visibility: "visible" },
    });
  });

  it("creates a Topic per new name, named as first written with single spaces, one per name in any case", () => {
    const planned = plan(["Fluid   Mechanics,a,b,,", "FLUID MECHANICS,c,d,,", "Hydraulics,e,f,,"]);

    expect(planned.topics.map((t) => [t.name, t.topicId, t.deck])).toEqual([
      ["Fluid Mechanics", null, null],
      ["Hydraulics", null, null],
    ]);
    expect(planned.topics[0]?.cards.map((c) => c.front)).toEqual(["a", "c"]);
  });

  it("gives an existing Topic without a deck a new one, and one with an empty deck that deck", () => {
    const planned = plan(["Surveying,a,b,,", "Algebra,c,d,,"]);

    expect(planned.topics.map((t) => [t.name, t.deck])).toEqual([
      ["Surveying", null],
      ["Algebra", { id: "d-algebra", visibility: "hidden" }],
    ]);
  });

  it("reads the headers in any order and case", () => {
    const planned = plan(["beam.png,Moment,$M$,Statics,"], {
      header: "IMAGE,Front,back,Topic,note",
      zip: zip(["beam.png", 100]),
    });

    expect(planned.problems).toEqual([]);
    expect(planned.topics[0]).toMatchObject({ name: "Statics" });
    expect(planned.topics[0]?.cards[0]).toMatchObject({ front: "Moment", image: "beam.png" });
  });

  it("accepts a literal \\$ and maths in every text field", () => {
    const planned = plan(["Costs,Ticket price,It costs \\$5,$\\frac{1}{2}$ off on Sundays,"]);

    expect(planned.problems).toEqual([]);
    expect(planned.topics[0]?.cards[0]).toMatchObject({
      back: "It costs \\$5",
      note: "$\\frac{1}{2}$ off on Sundays",
    });
  });

  it("takes text at each field's limit", () => {
    const planned = plan([
      `${"t".repeat(120)},${"f".repeat(500)},${"b".repeat(2000)},${"n".repeat(1000)},`,
    ]);

    expect(planned.problems).toEqual([]);
  });
});

describe("planCardImport: images", () => {
  it("finds each image in the zip by its file name, in any folder and any case", () => {
    const planned = plan(
      ["Statics,a,b,,beam.png", "Statics,c,d,,Truss.JPG", "Statics,e,f,,images/arch.webp"],
      { zip: zip(["images/beam.png", 10], ["photos/truss.jpg", 10], ["images/arch.webp", 10]) },
    );

    expect(planned.problems).toEqual([]);
    expect(planned.topics[0]?.cards.map((c) => c.image)).toEqual([
      "images/beam.png",
      "photos/truss.jpg",
      "images/arch.webp",
    ]);
  });

  it("ignores the __MACOSX folder a Mac adds to a zip", () => {
    const planned = plan(["Statics,a,b,,beam.png"], {
      zip: zip(["beam.png", 10], ["__MACOSX/._beam.png", 4], ["__MACOSX/beam.png", 4]),
    });

    expect(planned.problems).toEqual([]);
    expect(planned.topics[0]?.cards[0]?.image).toBe("beam.png");
  });

  it("lets two cards share one image", () => {
    const planned = plan(["Statics,a,b,,beam.png", "Statics,c,d,,beam.png"], {
      zip: zip(["beam.png", 10]),
    });

    expect(planned.problems).toEqual([]);
  });
});

describe("planCardImport: row errors, each naming its row and column", () => {
  it.each([
    ["topic", ",Moment,$M$,,"],
    ["front", "Statics,,$M$,,"],
    ["back", "Statics,Moment,   ,,"],
  ])("a blank %s", (column, line) => {
    expect(plan([line]).problems).toEqual([{ file: "csv", row: 2, column, message: "is blank" }]);
  });

  it.each([
    ["topic", `${"t".repeat(121)},a,b,,`, "is 121 characters; keep it to 120"],
    ["front", `T,${"f".repeat(501)},b,,`, "is 501 characters; keep it to 500"],
    ["back", `T,f,${"b".repeat(2001)},,`, "is 2,001 characters; keep it to 2,000"],
    ["note", `T,f,b,${"n".repeat(1001)},`, "is 1,001 characters; keep it to 1,000"],
  ])("a %s over its limit", (column, line, message) => {
    expect(plan([line]).problems).toEqual([{ file: "csv", row: 2, column, message }]);
  });

  it("counts characters, not bytes: 500 emoji fit a front", () => {
    expect(plan([`T,${"📐".repeat(500)},b,,`]).problems).toEqual([]);
  });

  it.each(["front", "back", "note"])("a formula that won't render in the %s", (column) => {
    const cells = { topic: "T", front: "f", back: "b", note: "", image: "" };
    const line = Object.values({ ...cells, [column]: "Half is $\\frac{1}{$" }).join(",");

    expect(plan([line]).problems).toEqual([
      {
        file: "csv",
        row: 2,
        column,
        message:
          "has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
      },
    ]);
  });

  it("a $ with no closing $", () => {
    expect(plan(["T,Price,It costs $5,,"]).problems).toEqual([
      {
        file: "csv",
        row: 2,
        column: "back",
        message: "has a $ with no closing $ (write a dollar sign as \\$)",
      },
    ]);
  });

  it("an image not in the zip", () => {
    expect(plan(["T,f,b,,beam.png"], { zip: zip(["truss.png", 10]) }).problems).toEqual([
      { file: "csv", row: 2, column: "image", message: "“beam.png” isn’t in the zip" },
    ]);
  });

  it("an image named with no zip chosen", () => {
    expect(plan(["T,f,b,,beam.png"], { zip: null }).problems).toEqual([
      {
        file: "csv",
        row: 2,
        column: "image",
        message: "names “beam.png”, but no zip of images was chosen",
      },
    ]);
  });

  it("an image in the zip more than once", () => {
    expect(
      plan(["T,f,b,,beam.png"], { zip: zip(["a/beam.png", 10], ["b/beam.png", 10]) }).problems,
    ).toEqual([
      { file: "csv", row: 2, column: "image", message: "“beam.png” is in the zip more than once" },
    ]);
  });

  it.each(["beam.gif", "beam.svg", "beam.heic", "beam"])(
    "an image that isn't a JPEG, PNG or WebP: %s",
    (name) => {
      expect(plan([`T,f,b,,${name}`], { zip: zip([name, 10]) }).problems).toEqual([
        {
          file: "csv",
          row: 2,
          column: "image",
          message: `“${name}” isn’t a JPEG, PNG or WebP image`,
        },
      ]);
    },
  );

  it("an image over 5 MB, and one at 5 MB taken", () => {
    const fiveMb = 5 * 1024 * 1024;
    const planned = plan(["T,f,b,,big.png", "T,f2,b2,,ok.png"], {
      zip: zip(["big.png", fiveMb + 1], ["ok.png", fiveMb]),
    });

    expect(planned.problems).toEqual([
      { file: "csv", row: 2, column: "image", message: "“big.png” is over 5 MB" },
    ]);
  });

  it("a row with more cells than the header has columns", () => {
    expect(plan(["T,f,b,,,extra"]).problems).toEqual([
      {
        file: "csv",
        row: 2,
        column: null,
        message:
          "has more cells than the header row has columns (is there a comma outside quotes?)",
      },
    ]);
  });

  it("takes a row with fewer cells, reading the missing ones as blank", () => {
    expect(plan(["T,f,b"]).problems).toEqual([]);
  });

  it("reports every problem in a row, and every row's, in order", () => {
    const planned = plan(["T,,b,,", "T,f,b,,", ",f,$x,,"]);

    expect(planned.problems).toEqual([
      { file: "csv", row: 2, column: "front", message: "is blank" },
      { file: "csv", row: 4, column: "topic", message: "is blank" },
      {
        file: "csv",
        row: 4,
        column: "back",
        message: "has a $ with no closing $ (write a dollar sign as \\$)",
      },
    ]);
  });

  it("leaves a row with problems out of the plan's cards", () => {
    const planned = plan(["T,,b,,", "T,f,b,,"]);

    expect(planned.topics[0]?.cards.map((c) => c.row)).toEqual([3]);
  });
});

describe("planCardImport: file errors", () => {
  it.each(["topic", "front", "back", "note", "image"])("a missing %s header", (missing) => {
    const header = HEADER.split(",")
      .filter((column) => column !== missing)
      .join(",");

    expect(plan(["a,b,c,d"], { header })).toEqual({
      topics: [],
      problems: [
        { file: "csv", row: 1, column: missing, message: "is missing from the header row" },
      ],
    });
  });

  it("an unknown header", () => {
    expect(plan(["T,f,b,,,red"], { header: `${HEADER},colour` })).toEqual({
      topics: [],
      problems: [
        {
          file: "csv",
          row: 1,
          column: "colour",
          message: "isn’t a column the template has (topic, front, back, note, image)",
        },
      ],
    });
  });

  it("a header twice", () => {
    expect(plan(["T,f,b,,,x"], { header: `${HEADER},Front` }).problems).toEqual([
      { file: "csv", row: 1, column: "front", message: "is in the header row twice" },
    ]);
  });

  it("a CSV with no cards under its header", () => {
    expect(plan([])).toEqual({
      topics: [],
      problems: [
        {
          file: "csv",
          row: null,
          column: null,
          message: "has no cards: add one row per card under the header row",
        },
      ],
    });
  });

  it(`a CSV with more than ${MAX_IMPORT_ROWS.toLocaleString("en")} cards`, () => {
    const lines = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `T,f${i},b,,`);

    expect(plan(lines).problems).toEqual([
      {
        file: "csv",
        row: null,
        column: null,
        message: "has more than 10,000 cards: split it into smaller files",
      },
    ]);
  });

  it.each([
    ["../x.png"],
    ["images/../../x.png"],
    ["/etc/x.png"],
    ["..\\x.png"],
    ["C:\\images\\x.png"],
    ["\\x.png"],
  ])("a zip with a file outside its folder: %s", (name) => {
    const planned = plan(["T,f,b,,x.png"], { zip: zip(["x.png", 10], [name, 10]) });

    expect(planned.problems).toEqual([
      {
        file: "zip",
        row: null,
        column: null,
        message: `has files outside its folder, which isn’t allowed: ${name}`,
      },
    ]);
  });

  it("names the first three files outside the zip's folder, and how many more", () => {
    const planned = plan(["T,f,b,,"], {
      zip: zip(["../a.png", 1], ["../b.png", 1], ["../c.png", 1], ["../d.png", 1], ["../e.png", 1]),
    });

    expect(planned.problems).toEqual([
      {
        file: "zip",
        row: null,
        column: null,
        message:
          "has files outside its folder, which isn’t allowed: ../a.png, ../b.png, ../c.png and 2 more",
      },
    ]);
  });

  // A zip over 200 MB is refused before it's read (zip.test.ts), and the seam reports it.
});

describe("planCardImport: new Topics and rename hints", () => {
  it("creates new Topics after the existing ones, in order of first appearance", () => {
    const planned = plan(["Hydraulics,a,b,,", "Surveying,c,d,,", "Statics,e,f,,"]);

    expect(planned.topics.filter((t) => t.topicId === null).map((t) => t.name)).toEqual([
      "Hydraulics",
      "Statics",
    ]);
  });

  it("asks “did you rename it?” of a new name within two edits of an existing Topic", () => {
    const planned = plan(["Simple Curve,a,b,,", "Surveyng,c,d,,", "Statics,e,f,,"]);

    expect(planned.topics.map((t) => [t.name, t.topicId, t.similarTo])).toEqual([
      ["Simple Curve", null, "Simple Curves"],
      ["Surveyng", null, "Surveying"],
      ["Statics", null, null],
    ]);
  });

  it("asks it of a name that differs only in its spaces", () => {
    const planned = plan(["SimpleCurves,a,b,,"]);

    expect(planned.topics[0]).toMatchObject({ topicId: null, similarTo: "Simple Curves" });
  });

  it("never asks it of an existing Topic, or of a short name", () => {
    const planned = plan(["Algebra,a,b,,", "Alg,c,d,,"], {
      topics: [...TOPICS, { id: "t-al", name: "Al", deck: null, cards: [] }],
    });

    expect(planned.topics.map((t) => t.similarTo)).toEqual([null, null]);
  });
});

describe("planCardImport: re-importing a Topic that has cards", () => {
  const reimport = [
    // Unchanged.
    "Simple Curves,Degree of curve,$D = 1145.916/R$,,",
    // Same front, with different spacing, and a new back.
    "Simple Curves,  Length   of curve ,$L_c = 20I/D$,,",
    // New.
    "Simple Curves,Middle ordinate,$M = R(1 - \\cos(I/2))$,,",
  ];

  it("Replace keeps the id of each card whose front is unchanged, and removes the rest", () => {
    const planned = plan(reimport, { mode: "replace" });
    const topic = planned.topics[0];

    expect(planned.problems).toEqual([]);
    expect(topic?.mode).toBe("replace");
    expect(topic?.cards.map((c) => [c.cardId, c.change, c.front])).toEqual([
      ["c-degree", "keep", "Degree of curve"],
      // Saved as typed (trimmed), so line breaks in a front survive.
      ["c-length", "replace", "Length   of curve"],
      [null, "add", "Middle ordinate"],
    ]);
    expect(topic?.removed).toEqual(["c-tangent"]);
    expect(counts(topic)).toEqual({ add: 1, replace: 1, keep: 1, remove: 1 });
  });

  it("Replace matches fronts case-sensitively", () => {
    const planned = plan(["Simple Curves,degree of curve,$D$,,"], { mode: "replace" });

    expect(planned.topics[0]?.cards[0]).toMatchObject({ cardId: null, change: "add" });
    expect(planned.topics[0]?.removed).toEqual(["c-degree", "c-length", "c-tangent"]);
  });

  it("Replace counts a card given a note or an image as replaced", () => {
    const planned = plan(
      [
        "Simple Curves,Degree of curve,$D = 1145.916/R$,A note,",
        "Simple Curves,Length of curve,$L = 20I/D$,,c.png",
      ],
      { mode: "replace", zip: zip(["c.png", 10]) },
    );

    expect(planned.topics[0]?.cards.map((c) => c.change)).toEqual(["replace", "replace"]);
  });

  it("Replace pairs repeated fronts with existing cards in order, and adds the extra", () => {
    const planned = plan(
      ["Simple Curves,Degree of curve,one,,", "Simple Curves,Degree of curve,two,,"],
      { mode: "replace" },
    );

    expect(planned.topics[0]?.cards.map((c) => c.cardId)).toEqual(["c-degree", null]);
  });

  it("Add appends every row after the existing cards, keeping them all", () => {
    const planned = plan(reimport, { mode: "add" });
    const topic = planned.topics[0];

    expect(topic?.mode).toBe("add");
    expect(topic?.cards.map((c) => [c.cardId, c.change])).toEqual([
      [null, "add"],
      [null, "add"],
      [null, "add"],
    ]);
    expect(topic?.removed).toEqual([]);
    expect(counts(topic)).toEqual({ add: 3, replace: 0, keep: 3, remove: 0 });
  });

  it("always adds to a Topic with no cards, whatever the mode", () => {
    const planned = plan(["Algebra,a,b,,", "Surveying,c,d,,"], { mode: "replace" });

    expect(planned.topics.map((t) => [t.mode, counts(t)])).toEqual([
      ["add", { add: 1, replace: 0, keep: 0, remove: 0 }],
      ["add", { add: 1, replace: 0, keep: 0, remove: 0 }],
    ]);
  });

  it("leaves Topics the CSV doesn't name alone", () => {
    const planned = plan(["Surveying,a,b,,"], { mode: "replace" });

    expect(planned.topics.map((t) => t.name)).toEqual(["Surveying"]);
  });
});
