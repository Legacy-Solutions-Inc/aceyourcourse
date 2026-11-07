import { describe, expect, it } from "vitest";

import { formatCount, formatRating } from "./figures";

describe("formatRating", () => {
  it.each([
    [4.8, "4.8"],
    [5, "5.0"],
    [4.25, "4.3"],
  ])("shows %j to one decimal place as %j", (rating, label) => {
    expect(formatRating(rating)).toBe(label);
  });
});

describe("formatCount", () => {
  it("groups thousands the Philippine way", () => {
    expect(formatCount(764)).toBe("764");
    expect(formatCount(1234567)).toBe("1,234,567");
  });
});
