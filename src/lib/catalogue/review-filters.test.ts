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

  it("counts the Exam chips over the Reviews every filter but the Exam lets through", () => {
    const counts = reviewFacetCounts({
      // With 5★ picked: the 5★ Reviews of every Exam.
      forExams: [review("CE", 5), review("CE", 5), review("ME", 5)],
      forStars: [],
    });
    expect(counts.exams).toEqual({ all: 3, byCode: { CE: 2, ME: 1 } });
  });

  it("counts the star chips over the Reviews every filter but the stars lets through", () => {
    const counts = reviewFacetCounts({
      forExams: [],
      // With CE picked: CE's Reviews of every star bucket.
      forStars: [review("CE", 5), review("CE", 4), review("CE", 3), review("CE", 2)],
    });
    expect(counts.stars).toEqual({ all: 4, byBucket: { "5": 1, "4": 1, "3-or-less": 2 } });
  });

  it("counts every written Review in both groups when nothing is picked", () => {
    const written = [review("CE", 5), review("CE", 4), review("MT", 1)];
    expect(reviewFacetCounts({ forExams: written, forStars: written })).toEqual({
      exams: { all: 3, byCode: { CE: 2, MT: 1 } },
      stars: { all: 3, byBucket: { "5": 1, "4": 1, "3-or-less": 1 } },
    });
  });

  it("is all zeros when the other filters let nothing through", () => {
    expect(reviewFacetCounts({ forExams: [], forStars: [] })).toEqual({
      exams: { all: 0, byCode: {} },
      stars: { all: 0, byBucket: { "5": 0, "4": 0, "3-or-less": 0 } },
    });
  });
});
