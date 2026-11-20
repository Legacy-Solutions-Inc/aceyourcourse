import { describe, expect, it } from "vitest";

import { cardImageType, matchingFront, textLength } from "./card-rules";

describe("cardImageType", () => {
  it.each([
    ["beam.png", "image/png"],
    ["BEAM.JPG", "image/jpeg"],
    ["images/beam.jpeg", "image/jpeg"],
    ["beam.webp", "image/webp"],
  ] as const)("reads %s as %s", (name, type) => {
    expect(cardImageType(name)).toBe(type);
  });

  it.each(["beam.gif", "beam.svg", "beam.heic", "beam", "beam.png.exe", "constructor"])(
    "refuses %s",
    (name) => {
      expect(cardImageType(name)).toBeNull();
    },
  );
});

describe("textLength", () => {
  it("counts characters as Postgres's char_length does: an emoji is one", () => {
    expect(textLength("📐 Beam")).toBe(6);
  });
});

describe("matchingFront", () => {
  it("trims a front and makes each run of whitespace one space, keeping its case", () => {
    expect(matchingFront("  Length \n of\tCurve ")).toBe("Length of Curve");
    expect(matchingFront("length of curve")).not.toBe(matchingFront("Length of curve"));
  });
});
