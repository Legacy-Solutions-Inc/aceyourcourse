import { describe, expect, it } from "vitest";

import type { Faq } from "@/services/catalogue.types";

import { faqAddress, faqListHref, faqListLabel, faqMeta, parseFaqListParams } from "./faq-list";

const FAQ: Faq = {
  id: "faq-005",
  slug: "posters",
  group: "paper",
  order: 2,
  question: "What are the posters like?",
  answer: "A3 size.",
  reviewQuote: { reviewId: "rev-014", text: "Glossy type yung paper" },
  popularLabel: null,
  requiresMemberApp: false,
  showOnFaqPage: true,
  showCoverageTable: false,
};

describe("parseFaqListParams", () => {
  it("reads the group, the search and the selected FAQ", () => {
    expect(
      parseFaqListParams({ tab: "faqs", group: "paper", q: " glossy ", faq: "faq-005" }),
    ).toEqual({ query: { group: "paper", q: "glossy" }, faq: "faq-005" });
  });

  it("leaves out what isn't there, and takes the first of repeated params", () => {
    expect(parseFaqListParams({ tab: "faqs" })).toEqual({ query: {}, faq: null });
    expect(parseFaqListParams({ group: ["buying", "paper"], faq: "new" })).toEqual({
      query: { group: "buying" },
      faq: "new",
    });
  });

  it("cuts an over-long search", () => {
    const { query } = parseFaqListParams({ q: "x".repeat(500) });
    expect(query.q?.length).toBeLessThan(500);
  });
});

describe("faqListHref", () => {
  it("is the FAQS tab with its group, search and selected FAQ", () => {
    expect(faqListHref({ group: "paper", q: "glossy" }, "faq-005")).toBe(
      "/admin/reviews?tab=faqs&group=paper&q=glossy&faq=faq-005",
    );
    expect(faqListHref({ group: "shipping", q: null })).toBe(
      "/admin/reviews?tab=faqs&group=shipping",
    );
  });

  it("leaves the group out when none is given, so the tab opens on its first group", () => {
    expect(faqListHref({}, "new")).toBe("/admin/reviews?tab=faqs&faq=new");
  });
});

describe("faqListLabel", () => {
  it("names the group, its count and ▲▼ (mockup 1188)", () => {
    expect(faqListLabel({ group: "shipping", q: null }, 3)).toBe(
      "SHIPPING · 3 QUESTIONS · ▲▼ TO REORDER",
    );
    expect(faqListLabel({ group: "authenticity", q: null }, 1)).toBe(
      "AUTHENTICITY · 1 QUESTION · ▲▼ TO REORDER",
    );
  });

  it("counts the matches in every group while searching", () => {
    expect(faqListLabel({ group: "shipping", q: "shopee" }, 8)).toBe("8 MATCHES IN ALL GROUPS");
    expect(faqListLabel({ group: "shipping", q: "gcash" }, 1)).toBe("1 MATCH IN ALL GROUPS");
  });
});

describe("faqMeta", () => {
  it("says whether it has a review quote (mockup 1183)", () => {
    expect(faqMeta(FAQ, false)).toBe("WITH REVIEW QUOTE");
    expect(faqMeta({ ...FAQ, reviewQuote: null }, false)).toBe("ANSWER ONLY");
  });

  it("marks a hidden FAQ, and an app-only one", () => {
    expect(faqMeta({ ...FAQ, showOnFaqPage: false }, false)).toBe("WITH REVIEW QUOTE · HIDDEN");
    expect(faqMeta({ ...FAQ, requiresMemberApp: true }, false)).toBe(
      "WITH REVIEW QUOTE · MEMBER APP ONLY",
    );
  });

  it("names the group first while searching", () => {
    expect(faqMeta(FAQ, true)).toBe("PAPER AND PRINT · WITH REVIEW QUOTE");
  });
});

describe("faqAddress", () => {
  it("is the FAQ's deep link on the site", () => {
    expect(faqAddress("posters")).toBe("aceyourcourse.ph/faq#faq-posters");
  });
});
