import { describe, expect, it } from "vitest";

import type { AdminReviewRow } from "@/services/admin.types";

import {
  parseReviewListParams,
  pinnedOnHomeLine,
  reviewListHref,
  reviewMeta,
  reviewName,
  reviewsTabHref,
} from "./review-list";

const NO_FILTERS = { q: null, exam: null, stars: null, pinned: false };

const row = (review: Partial<AdminReviewRow["review"]> = {}): AdminReviewRow => ({
  review: {
    id: "rev-013",
    productId: "prd-005",
    stars: 5,
    text: "Perfect quality",
    variation: "MSTC, HPGE, PSAD",
    helpful: 19,
    marketplace: "shopee",
    homePin: 1,
    ...review,
  },
  product: { shortName: "Ultimate CE Posters 2.0", examCode: "CE" },
});

describe("parseReviewListParams", () => {
  it("reads no filters, no selection and the REVIEWS tab from an empty URL", () => {
    expect(parseReviewListParams({})).toEqual({ tab: "reviews", query: {}, review: null });
  });

  it("reads the search, Exam, stars, Pinned on Home only and the selected Review", () => {
    expect(
      parseReviewListParams({
        q: "glossy",
        exam: "ce",
        stars: "5",
        pinned: "1",
        review: "rev-014",
      }),
    ).toEqual({
      tab: "reviews",
      query: { q: "glossy", exam: "ce", stars: "5", pinned: true },
      review: "rev-014",
    });
  });

  it("reads 3★ and below as stars=3, and ignores stars it doesn't know", () => {
    expect(parseReviewListParams({ stars: "3" }).query.stars).toBe("3-or-less");
    expect(parseReviewListParams({ stars: "4" }).query.stars).toBe("4");
    expect(parseReviewListParams({ stars: "2" }).query.stars).toBeUndefined();
  });

  it("reads the FAQS tab, and a new Review as review=new", () => {
    expect(parseReviewListParams({ tab: "faqs" }).tab).toBe("faqs");
    expect(parseReviewListParams({ tab: "other" }).tab).toBe("reviews");
    expect(parseReviewListParams({ review: "new" }).review).toBe("new");
  });

  it("takes the first of a repeated value, and cuts a long search", () => {
    expect(parseReviewListParams({ q: ["a", "b"] }).query.q).toBe("a");
    expect(parseReviewListParams({ q: "x".repeat(300) }).query.q).toHaveLength(100);
  });
});

describe("reviewListHref", () => {
  it("is the bare screen with no filters", () => {
    expect(reviewListHref(NO_FILTERS)).toBe("/admin/reviews");
  });

  it("puts every filter and the selected Review in the URL, the Exam lowercased", () => {
    expect(
      reviewListHref({ q: "glossy", exam: "CE", stars: "3-or-less", pinned: true }, "rev-014"),
    ).toBe("/admin/reviews?q=glossy&exam=ce&stars=3&pinned=1&review=rev-014");
  });

  it("reads back what it writes", () => {
    const query = { q: "sulit na", exam: "ME", stars: "5", pinned: false } as const;
    const params = Object.fromEntries(
      new URL(reviewListHref(query, "new"), "https://x").searchParams,
    );
    expect(parseReviewListParams(params)).toEqual({
      tab: "reviews",
      query: { q: "sulit na", exam: "me", stars: "5" },
      review: "new",
    });
  });
});

describe("reviewsTabHref", () => {
  it("is the bare screen for REVIEWS and tab=faqs for FAQS, read back by the parser", () => {
    expect(reviewsTabHref("reviews")).toBe("/admin/reviews");
    expect(reviewsTabHref("faqs")).toBe("/admin/reviews?tab=faqs");
    expect(parseReviewListParams({ tab: "faqs" }).tab).toBe("faqs");
  });
});

describe("reviewMeta", () => {
  it("reads like the mockup's meta line, with the Review's real Marketplace", () => {
    expect(reviewMeta(row())).toBe(
      "CE · ULTIMATE CE POSTERS 2.0 · MSTC, HPGE, PSAD · SHOPEE · 19 HELPFUL",
    );
    expect(reviewMeta(row({ marketplace: "tiktok" }))).toContain("· TIKTOK SHOP ·");
  });

  it("leaves out a variation that isn't specified, and no helpful votes", () => {
    expect(reviewMeta(row({ variation: null, helpful: 0, marketplace: "lazada" }))).toBe(
      "CE · ULTIMATE CE POSTERS 2.0 · LAZADA",
    );
  });
});

describe("pinnedOnHomeLine", () => {
  it("counts the pins against Home's 9", () => {
    expect(pinnedOnHomeLine(9)).toEqual({ text: "9 OF 9 PINNED ON HOME", over: false });
    expect(pinnedOnHomeLine(0)).toEqual({ text: "0 OF 9 PINNED ON HOME", over: false });
  });

  it("warns above 9: Home shows the first 9", () => {
    expect(pinnedOnHomeLine(10)).toEqual({
      text: "10 OF 9 PINNED ON HOME · HOME SHOWS THE FIRST 9",
      over: true,
    });
  });
});

describe("reviewName", () => {
  it("names a Review by its first six words, on one line, in quotes", () => {
    expect(reviewName("Perfect quality for\nEngineering students, fresh grads and retakers")).toBe(
      "“Perfect quality for Engineering students, fresh…”",
    );
  });

  it("gives a short Review whole", () => {
    expect(reviewName("  Sulit talaga!  ")).toBe("“Sulit talaga!”");
  });
});
