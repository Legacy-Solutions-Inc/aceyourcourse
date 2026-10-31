import { describe, expect, it } from "vitest";

import { reviewsHref } from "./review-filters";
import { parseReviewSearchParams } from "./review-search-params";

const CONTEXT = {
  productSlugs: ["ce-formula-flash-cards", "medtech-essential-notebook"],
  examCodes: ["CE", "ME", "EE", "MT", "CPA"],
};

/** The search params Next.js passes a page for this Reviews URL. */
function searchParamsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://localhost").searchParams);
}

describe("parseReviewSearchParams", () => {
  it("reads every filter from the URL", () => {
    expect(
      parseReviewSearchParams(
        {
          product: "ce-formula-flash-cards",
          exam: "ce",
          stars: "3-or-less",
          q: "delivery",
          sort: "most-critical",
        },
        CONTEXT,
      ),
    ).toEqual({
      productSlug: "ce-formula-flash-cards",
      examCode: "CE",
      stars: "3-or-less",
      query: "delivery",
      sort: "most-critical",
    });
  });

  it("is empty for the plain Reviews page", () => {
    expect(parseReviewSearchParams({}, CONTEXT)).toEqual({});
  });

  it("ignores an unknown Product, Exam, star bucket or sort instead of throwing", () => {
    expect(
      parseReviewSearchParams(
        { product: "nope", exam: "zz", stars: "2", sort: "bogus", q: "" },
        CONTEXT,
      ),
    ).toEqual({});
  });

  it("matches the Exam code in any case", () => {
    expect(parseReviewSearchParams({ exam: "Cpa" }, CONTEXT)).toEqual({ examCode: "CPA" });
  });

  it("matches the Product slug exactly", () => {
    expect(parseReviewSearchParams({ product: "CE-Formula-Flash-Cards" }, CONTEXT)).toEqual({});
  });

  it.each(["5", "4", "3-or-less"] as const)("reads the star bucket %s", (stars) => {
    expect(parseReviewSearchParams({ stars }, CONTEXT)).toEqual({ stars });
  });

  it.each(["highest", "most-critical", "most-detailed"] as const)("reads the sort %s", (sort) => {
    expect(parseReviewSearchParams({ sort }, CONTEXT)).toEqual({ sort });
  });

  it("leaves out the default sort, and the Exam page's own sort", () => {
    expect(parseReviewSearchParams({ sort: "most-helpful" }, CONTEXT)).toEqual({});
    expect(parseReviewSearchParams({ sort: "exam-page" }, CONTEXT)).toEqual({});
  });

  it("trims the search, ignores a blank one and keeps at most 100 characters", () => {
    expect(parseReviewSearchParams({ q: "  font size  " }, CONTEXT)).toEqual({
      query: "font size",
    });
    expect(parseReviewSearchParams({ q: "   " }, CONTEXT)).toEqual({});
    expect(parseReviewSearchParams({ q: "x".repeat(150) }, CONTEXT).query).toHaveLength(100);
  });

  it("takes the first of a repeated key", () => {
    expect(parseReviewSearchParams({ stars: ["4", "5"] }, CONTEXT)).toEqual({ stars: "4" });
  });
});

describe("parseReviewSearchParams with reviewsHref", () => {
  it("round-trips every filter through the URL", () => {
    for (const href of [
      "/reviews",
      "/reviews?product=ce-formula-flash-cards",
      "/reviews?exam=mt&stars=3-or-less",
      "/reviews?product=medtech-essential-notebook&exam=mt&stars=4&q=paper+%26+print&sort=highest",
      "/reviews?q=delivery&sort=most-critical",
    ]) {
      expect(reviewsHref(parseReviewSearchParams(searchParamsOf(href), CONTEXT))).toBe(href);
    }
  });

  it("canonicalises a messy URL to the one URL for its filters", () => {
    const filters = parseReviewSearchParams(
      searchParamsOf("/reviews?sort=most-helpful&q=+paper+&stars=2&exam=CE&product=nope"),
      CONTEXT,
    );
    expect(reviewsHref(filters)).toBe("/reviews?exam=ce&q=paper");
  });
});
