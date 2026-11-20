import { describe, expect, it } from "vitest";

import { ADD_A_BACK, ADD_A_FRONT, cardFieldProblems, cardFieldsOf } from "./card-fields";
import {
  CARD_TEXT_LIMITS,
  cardImageProblem,
  EMPTY_IMAGE,
  IMAGE_TOO_BIG,
  MAX_CARD_IMAGE_BYTES,
  WRONG_IMAGE_TYPE,
} from "./card-rules";

// A card's fields as the card editor judges them (Phase 3, ticket 07; spec,
// Phase 3 → Content model): a front and a back are required, each field has
// the import's length limit, and every field must render as a formula.

const card = (fields: Partial<{ front: string; back: string; note: string }> = {}) => ({
  front: "Degree of curve",
  back: "$D = \\frac{1145.916}{R}$",
  note: "",
  ...fields,
});

describe("cardFieldProblems", () => {
  it("accepts a card with maths, a literal \\$, and no note", () => {
    expect(cardFieldProblems(card({ note: "It costs \\$5" }))).toEqual({});
    expect(cardFieldProblems(card())).toEqual({});
  });

  it("refuses an empty front or back, even one of spaces", () => {
    expect(cardFieldProblems(card({ front: "  ", back: "" }))).toEqual({
      front: ADD_A_FRONT,
      back: ADD_A_BACK,
    });
  });

  it.each(Object.entries(CARD_TEXT_LIMITS))(
    "takes a %s of %i characters, and refuses one more",
    (field, limit) => {
      expect(cardFieldProblems(card({ [field]: "a".repeat(limit) }))).toEqual({});
      expect(cardFieldProblems(card({ [field]: "a".repeat(limit + 1) }))).toEqual({
        [field]: `KEEP IT TO ${limit.toLocaleString("en")} CHARACTERS`,
      });
    },
  );

  it("counts characters as Postgres does, so an emoji is one", () => {
    const emoji = "😀".repeat(CARD_TEXT_LIMITS.front);
    expect(cardFieldProblems(card({ front: emoji }))).toEqual({});
  });

  it("judges the text as saved, trimmed of spaces at either end", () => {
    const padded = ` ${"a".repeat(CARD_TEXT_LIMITS.front)} `;
    expect(cardFieldProblems(card({ front: padded }))).toEqual({});
  });

  it("refuses a formula that won't render, naming the field and quoting it", () => {
    expect(cardFieldProblems(card({ back: "$\\frac{1}{$" }))).toEqual({
      back: "The back has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
    });
    expect(cardFieldProblems(card({ note: "Costs $5" }))).toEqual({
      note: "The note has a $ with no closing $ (write a dollar sign as \\$)",
    });
  });
});

describe("cardFieldsOf", () => {
  it("gives the fields as saved: trimmed, with an empty note as none", () => {
    expect(cardFieldsOf({ front: " Grade ", back: "\nRise over run\n", note: "  " })).toEqual({
      front: "Grade",
      back: "Rise over run",
      note: null,
    });
    expect(cardFieldsOf({ front: "Grade", back: "Rise", note: " % " })).toMatchObject({
      note: "%",
    });
  });
});

describe("cardImageProblem", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts a %s", (type) => {
    expect(cardImageProblem({ type, size: 1024 })).toBeNull();
  });

  it("accepts an image of exactly 5 MB, and refuses one byte more", () => {
    expect(cardImageProblem({ type: "image/png", size: MAX_CARD_IMAGE_BYTES })).toBeNull();
    expect(cardImageProblem({ type: "image/png", size: MAX_CARD_IMAGE_BYTES + 1 })).toBe(
      IMAGE_TOO_BIG,
    );
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])("refuses a %j", (type) => {
    expect(cardImageProblem({ type, size: 1024 })).toBe(WRONG_IMAGE_TYPE);
  });

  it("refuses an empty file", () => {
    expect(cardImageProblem({ type: "image/png", size: 0 })).toBe(EMPTY_IMAGE);
  });
});
