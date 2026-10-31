import { describe, expect, it } from "vitest";

import type { ReviewWithProduct } from "@/services/catalogue.types";

import { testReview } from "../../../test/fixtures/catalogue";
import { reviewFacetCounts, reviewsHref } from "./review-filters";

describe("reviewsHref", () => {
  it("is the plain Reviews page with no filters", () => {
    expect(reviewsHref({})).toBe("/reviews");
  });

  it("writes the keys in a fixed order, the Exam in lowercase", () => {
    expect(
      reviewsHref({
        sort: "most-detailed",
        query: "font size",
        stars: "5",
        examCode: "CE",
        productSlug: "ce-formula-flash-cards",
      }),
    ).toBe(
      "/reviews?product=ce-formula-flash-cards&exam=ce&stars=5&q=font+size&sort=most-detailed",
    );
  });

  it("leaves out the default sort and a blank search", () => {
    expect(reviewsHref({ sort: "most-helpful", query: "   " })).toBe("/reviews");
  });
});

describe("reviewFacetCounts", () => {
  const review = (examCode: string, stars: ReviewWithProduct["stars"]) => {
    const base = testReview();
    return testReview({ stars, product: { ...base.product, examCode } });
  };

  it("counts every written Review, by Exam and by star bucket", () => {
    const counts = reviewFacetCounts([
      review("CE", 5),
      review("CE", 5),
      review("CE", 4),
      review("ME", 5),
      review("MT", 3),
      review("MT", 2),
      review("MT", 1),
    ]);
    expect(counts).toEqual({
      all: 7,
      exams: { CE: 3, ME: 1, MT: 3 },
      stars: { "5": 3, "4": 1, "3-or-less": 3 },
    });
  });

  it("puts 3, 2 and 1 star Reviews in the ≤3★ bucket, and 4 in its own", () => {
    const counts = reviewFacetCounts([review("CE", 4), review("CE", 3)]);
    expect(counts.stars).toEqual({ "5": 0, "4": 1, "3-or-less": 1 });
  });

  it("is all zeros with no Reviews", () => {
    expect(reviewFacetCounts([])).toEqual({
      all: 0,
      exams: {},
      stars: { "5": 0, "4": 0, "3-or-less": 0 },
    });
  });
});
