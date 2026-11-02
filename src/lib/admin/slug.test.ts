import { describe, expect, it } from "vitest";

import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with single hyphens", () => {
    expect(slugify("MT Notebook")).toBe("mt-notebook");
    expect(slugify("  Ultimate CE Posters 2.0  ")).toBe("ultimate-ce-posters-2-0");
  });

  it("turns accented letters into plain ASCII", () => {
    expect(slugify("Lepaña’s Café Notebook")).toBe("lepanas-cafe-notebook");
  });

  it("drops symbols and squeezes the gaps they leave", () => {
    expect(slugify("CE Review Bundle (3-in-1) — MSTC & HPGE!!")).toBe(
      "ce-review-bundle-3-in-1-mstc-hpge",
    );
  });

  it("names a Product with no letters or digits “product”", () => {
    expect(slugify("₱ — !!")).toBe("product");
  });

  it("cuts a long name at a word, at most 60 characters", () => {
    const slug = slugify(
      "Civil Engineering Formula Flash Cards for the CELE Board Exam, School and Professional Review",
    );
    expect(slug).toBe("civil-engineering-formula-flash-cards-for-the-cele-board");
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it("cuts a single over-long word at 60 characters", () => {
    expect(slugify("a".repeat(80))).toBe("a".repeat(60));
  });
});

describe("uniqueSlug", () => {
  it("keeps the name's slug when no Product has it", () => {
    expect(uniqueSlug("MT Notebook", ["me-notebook"])).toBe("mt-notebook");
  });

  it("adds -2, then -3, when the slug is taken", () => {
    expect(uniqueSlug("ME Notebook", ["me-notebook"])).toBe("me-notebook-2");
    expect(uniqueSlug("ME Notebook", ["me-notebook", "me-notebook-2"])).toBe("me-notebook-3");
  });

  it("stays within 60 characters with its number", () => {
    const name = "a".repeat(80);
    expect(uniqueSlug(name, ["a".repeat(60)])).toBe(`${"a".repeat(58)}-2`);
  });
});

describe("slugs of another length", () => {
  const FAQ = { max: 40, fallback: "question" };

  it("cuts at a word, at most the length given", () => {
    const slug = slugify(
      "How long does it take for an order to reach Mindanao by the courier?",
      FAQ,
    );
    expect(slug).toBe("how-long-does-it-take-for-an-order-to");
  });

  it("names a slug with no letters or digits by the fallback given", () => {
    expect(slugify("₱?", FAQ)).toBe("question");
  });

  it("keeps a unique slug within the length, suffix included", () => {
    const taken = ["how-long-does-it-take-for-an-order-to"];
    const slug = uniqueSlug(
      "How long does it take for an order to reach Mindanao by the courier?",
      taken,
      FAQ,
    );
    expect(slug).toBe("how-long-does-it-take-for-an-order-to-2");
    expect(slug.length).toBeLessThanOrEqual(40);
  });
});
