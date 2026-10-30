import { describe, expect, it } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import {
  productFullPrice,
  productOptionsNote,
  productPriceLabel,
  productPriceRange,
  variationLabel,
} from "./price";

describe("productPriceLabel", () => {
  it("shows a single price", () => {
    expect(productPriceLabel(testLiveProduct({ priceFrom: 120000, priceTo: null }))).toBe("₱1,200");
  });

  it('shows "from" the lowest price when the Product is priced as a range', () => {
    expect(productPriceLabel(testLiveProduct({ priceFrom: 60000, priceTo: 155000 }))).toBe(
      "from ₱600",
    );
  });

  it("is null for a Coming Soon Product, so no ₱0 can render", () => {
    expect(productPriceLabel(testComingSoonProduct())).toBeNull();
  });
});

describe("productFullPrice", () => {
  it("is the top of a range: a bundle's whole set", () => {
    // The CE bundle sells each part from ₱1,200, or the 3-in-1 at ₱3,499.
    expect(productFullPrice(testLiveProduct({ priceFrom: 120000, priceTo: 349900 }))).toBe(
      "₱3,499",
    );
  });

  it("is the single price when there is no range", () => {
    expect(productFullPrice(testLiveProduct({ priceFrom: 120000, priceTo: null }))).toBe("₱1,200");
  });

  it("is null for a Coming Soon Product, so no ₱0 can render", () => {
    expect(productFullPrice(testComingSoonProduct({ priceFrom: 0 }))).toBeNull();
  });
});

describe("productPriceRange", () => {
  it("shows the full range", () => {
    expect(productPriceRange(testLiveProduct({ priceFrom: 60000, priceTo: 155000 }))).toBe(
      "₱600–₱1,550",
    );
  });

  it("shows a single price when there is no range, or the range is one price", () => {
    expect(productPriceRange(testLiveProduct({ priceFrom: 120000, priceTo: null }))).toBe("₱1,200");
    expect(productPriceRange(testLiveProduct({ priceFrom: 120000, priceTo: 120000 }))).toBe(
      "₱1,200",
    );
  });

  it("is null for a Coming Soon Product", () => {
    expect(productPriceRange(testComingSoonProduct())).toBeNull();
  });
});

describe("variationLabel", () => {
  it.each([
    ["CE POSTERS 2.0: MSTC ONLY", "MSTC ONLY"],
    ["REVIEW BUNDLE: 3-IN-1 FC|NB|POS 2.0", "3-IN-1 FC|NB|POS 2.0"],
    ["FLASH CARDS: BUNDLE / PAPER TYPE: 160 gsm", "BUNDLE / PAPER TYPE: 160 gsm"],
  ])("strips the prefix from %j", (name, label) => {
    expect(variationLabel(name)).toBe(label);
  });

  it("leaves a name with no prefix unchanged", () => {
    expect(variationLabel("All three subjects")).toBe("All three subjects");
  });
});

describe("productOptionsNote", () => {
  it("tells a range-priced Product's shopper to pick on the store page", () => {
    expect(productOptionsNote(testLiveProduct({ priceFrom: 60000, priceTo: 155000 }))).toBe(
      "Sold per subject or as a full set. Pick your option on the store page: ₱600 to ₱1,550.",
    );
  });

  it("says there is one option for a single price", () => {
    expect(productOptionsNote(testLiveProduct({ priceTo: null }))).toBe(
      "One option: the complete set.",
    );
    expect(productOptionsNote(testLiveProduct({ priceFrom: 120000, priceTo: 120000 }))).toBe(
      "One option: the complete set.",
    );
  });

  it("is null for a Coming Soon Product", () => {
    expect(productOptionsNote(testComingSoonProduct())).toBeNull();
  });
});
