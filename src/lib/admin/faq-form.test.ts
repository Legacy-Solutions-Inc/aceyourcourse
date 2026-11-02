import { describe, expect, it } from "vitest";

import { faqFormSchema } from "@/services/admin.schema";
import type { Faq } from "@/services/catalogue.types";

import { faqFormValues, faqSlugFor, newFaqForm, quoteCredit } from "./faq-form";

const FAQ: Faq = {
  id: "faq-005",
  slug: "posters",
  group: "paper",
  order: 2,
  question: "What are the posters like?",
  answer: "A3 size.",
  reviewQuote: { reviewId: "rev-014", text: "Glossy type yung paper" },
  popularLabel: "Posters?",
  requiresMemberApp: true,
  showOnFaqPage: false,
  showCoverageTable: true,
};

describe("faqFormValues", () => {
  it("opens an FAQ's fields, and saves them back unchanged", () => {
    const values = faqFormValues(FAQ);

    expect(values).toEqual({
      question: "What are the posters like?",
      answer: "A3 size.",
      group: "paper",
      quoteReviewId: "rev-014",
      quoteText: "Glossy type yung paper",
      popular: true,
      popularLabel: "Posters?",
      requiresMemberApp: true,
      showOnFaqPage: false,
      showCoverageTable: true,
    });
    const { id: _id, slug: _slug, order: _order, ...fields } = FAQ;
    expect(faqFormSchema.parse(values)).toEqual(fields);
  });

  it("opens an FAQ with no quote or chip as empty fields, Popular off", () => {
    expect(faqFormValues({ ...FAQ, reviewQuote: null, popularLabel: null })).toMatchObject({
      quoteReviewId: "",
      quoteText: "",
      popular: false,
      popularLabel: "",
    });
  });
});

describe("newFaqForm", () => {
  it("is empty, in the group given, shown on the FAQ page", () => {
    expect(newFaqForm("buying")).toEqual({
      question: "",
      answer: "",
      group: "buying",
      quoteReviewId: "",
      quoteText: "",
      popular: false,
      popularLabel: "",
      requiresMemberApp: false,
      showOnFaqPage: true,
      showCoverageTable: false,
    });
  });
});

describe("quoteCredit", () => {
  it("is the stars and the Product's short name (mockup 1204)", () => {
    expect(
      quoteCredit({ stars: 5, product: { shortName: "Ultimate CE Posters 2.0", examCode: "CE" } }),
    ).toBe("★★★★★ · Ultimate CE Posters 2.0");
    expect(quoteCredit({ stars: 3, product: { shortName: "MT Cards", examCode: "MT" } })).toBe(
      "★★★ · MT Cards",
    );
  });
});

describe("faqSlugFor", () => {
  it("makes the question's slug, at most 40 characters, unique", () => {
    expect(faqSlugFor("Can I pay by GCash?", [])).toBe("can-i-pay-by-gcash");
    expect(faqSlugFor("Ship?", ["ship"])).toBe("ship-2");
    expect(faqSlugFor("", [])).toBe("question");
  });
});
