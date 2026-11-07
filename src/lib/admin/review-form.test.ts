import { describe, expect, it } from "vitest";

import type { ReviewProductOption } from "@/services/admin.types";
import type { Review } from "@/services/catalogue.types";

import {
  newReviewForm,
  productOptionLabel,
  reviewFormValues,
  reviewPreview,
  variationChoices,
} from "./review-form";

const POSTERS: ReviewProductOption = {
  id: "prd-005",
  slug: "ultimate-ce-posters-2-0",
  examCode: "CE",
  shortName: "Ultimate CE Posters 2.0",
  variations: ["MSTC, HPGE, PSAD", "MSTC ONLY"],
};

const REVIEW: Review = {
  id: "rev-014",
  productId: "prd-005",
  stars: 4,
  text: "Glossy type yung paper.\nQuality 10/10.",
  variation: null,
  helpful: 0,
  marketplace: "lazada",
  homePin: 6,
};

describe("reviewFormValues and newReviewForm", () => {
  it("opens a Review's fields, with no variation as blank and the votes as text", () => {
    expect(reviewFormValues(REVIEW)).toEqual({
      stars: 4,
      text: "Glossy type yung paper.\nQuality 10/10.",
      productId: "prd-005",
      variation: "",
      marketplace: "lazada",
      helpful: "0",
    });
  });

  it("starts a new Review at 5★ from Shopee, unpinned, for the Product given", () => {
    expect(newReviewForm("prd-001")).toEqual({
      stars: 5,
      text: "",
      productId: "prd-001",
      variation: "",
      marketplace: "shopee",
      helpful: "",
      pinned: false,
    });
  });
});

describe("variationChoices", () => {
  it("offers the Product's variations", () => {
    expect(variationChoices(POSTERS, null)).toEqual(["MSTC, HPGE, PSAD", "MSTC ONLY"]);
    expect(variationChoices(undefined, null)).toEqual([]);
  });

  it("keeps the Review's own variation, copied from the store, first", () => {
    const saved = { productId: "prd-005", variation: "MSTC, HPGE, PSAD,160 gsm" };
    expect(variationChoices(POSTERS, saved)).toEqual([
      "MSTC, HPGE, PSAD,160 gsm",
      "MSTC, HPGE, PSAD",
      "MSTC ONLY",
    ]);
  });

  it("doesn't repeat it, or offer it on another Product", () => {
    expect(variationChoices(POSTERS, { productId: "prd-005", variation: "MSTC ONLY" })).toEqual([
      "MSTC, HPGE, PSAD",
      "MSTC ONLY",
    ]);
    expect(variationChoices(POSTERS, { productId: "prd-001", variation: "BUNDLE" })).toEqual([
      "MSTC, HPGE, PSAD",
      "MSTC ONLY",
    ]);
  });
});

describe("productOptionLabel", () => {
  it("names a Product by its Exam and short name", () => {
    expect(productOptionLabel(POSTERS)).toBe("CE · Ultimate CE Posters 2.0");
  });
});

describe("reviewPreview", () => {
  const form = reviewFormValues(REVIEW);

  it("gives the Website's card for the form, with the Product", () => {
    expect(reviewPreview({ ...form, variation: "MSTC ONLY", helpful: "7" }, POSTERS)).toEqual({
      id: "preview",
      productId: "prd-005",
      stars: 4,
      text: REVIEW.text,
      variation: "MSTC ONLY",
      helpful: 7,
      marketplace: "lazada",
      homePin: null,
      product: { slug: POSTERS.slug, shortName: POSTERS.shortName, examCode: "CE" },
    });
  });

  it("shows nothing until there's text and a Product", () => {
    expect(reviewPreview({ ...form, text: "  \n" }, POSTERS)).toBeNull();
    expect(reviewPreview(form, undefined)).toBeNull();
  });

  it("shows stars that aren't 1 to 5 as 5★", () => {
    expect(reviewPreview({ ...form, stars: 0 }, POSTERS)?.stars).toBe(5);
    expect(reviewPreview({ ...form, stars: 2.5 }, POSTERS)?.stars).toBe(5);
    expect(reviewPreview({ ...form, stars: 2 }, POSTERS)?.stars).toBe(2);
  });

  it("shows votes that aren't a whole number yet as none", () => {
    expect(reviewPreview({ ...form, helpful: "2.5" }, POSTERS)?.helpful).toBe(0);
    expect(reviewPreview({ ...form, helpful: "-3" }, POSTERS)?.helpful).toBe(0);
  });
});
