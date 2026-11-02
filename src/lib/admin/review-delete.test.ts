import { describe, expect, it } from "vitest";

import { reviewDeleteCopy } from "./review-delete";

describe("reviewDeleteCopy", () => {
  it("uses the mockup's copy, and says how many FAQ quotes go (mockup 1574)", () => {
    expect(reviewDeleteCopy({ faqQuotes: 1 })).toEqual({
      title: "Delete this review?",
      body: [
        "It’s removed from Home, its product page, and its exam page.",
        "The original stays on the store.",
        "1 FAQ quote from this Review is removed.",
        "This can’t be undone.",
      ].join(" "),
    });
  });

  it("counts several FAQ quotes in the plural", () => {
    expect(reviewDeleteCopy({ faqQuotes: 2 }).body).toContain(
      "2 FAQ quotes from this Review are removed.",
    );
  });

  it("says nothing of FAQ quotes when none are taken from it", () => {
    expect(reviewDeleteCopy({ faqQuotes: 0 }).body).toBe(
      "It’s removed from Home, its product page, and its exam page. The original stays on the store. This can’t be undone.",
    );
  });
});
