import { describe, expect, it } from "vitest";

import type { Product } from "@/services/catalogue.types";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import {
  bundleSaving,
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

describe("bundleSaving", () => {
  // The seed's CE bundle: each part on its own, or all three as the 3-in-1.
  const ceBundle = (overrides: Partial<Product> = {}) =>
    testLiveProduct({
      format: "bundle",
      priceFrom: 120000,
      priceTo: 349900,
      variations: [
        { name: "REVIEW BUNDLE: CE FLASH CARDS 2.0", price: 120000 },
        { name: "REVIEW BUNDLE: CE NOTEBOOK 2.0", price: 124900 },
        { name: "REVIEW BUNDLE: CE POSTERS 2.0", price: 125000 },
        { name: "REVIEW BUNDLE: 3-IN-1 FC|NB|POS 2.0", price: 349900 },
      ],
      ...overrides,
    });

  it("is what the whole set saves over buying its parts one by one, in centavos", () => {
    // ₱1,200 + ₱1,249 + ₱1,250 = ₱3,699, against ₱3,499.
    expect(bundleSaving(ceBundle())).toBe(20000);
  });

  it("reads the whole set as the dearest option, in any order", () => {
    const { variations } = ceBundle();
    expect(bundleSaving(ceBundle({ variations: [...variations].reverse() }))).toBe(20000);
  });

  it("is null when the whole set costs as much as its parts, or more", () => {
    const at = (whole: number) =>
      ceBundle({
        variations: [
          { name: "A", price: 100000 },
          { name: "B", price: 100000 },
          { name: "A + B", price: whole },
        ],
      });
    expect(bundleSaving(at(199900))).toBe(100);
    expect(bundleSaving(at(200000))).toBeNull();
    expect(bundleSaving(at(210000))).toBeNull();
  });

  it("is null with fewer than two parts, which can't be a set", () => {
    expect(bundleSaving(ceBundle({ variations: [] }))).toBeNull();
    const twoOptions = [
      { name: "A", price: 100000 },
      { name: "A + B", price: 300000 },
    ];
    expect(bundleSaving(ceBundle({ variations: twoOptions }))).toBeNull();
  });

  it("is null for a Product that isn't a bundle, whose options aren't parts", () => {
    // Poster sets are cheaper than single posters, but only a bundle claims a saving.
    expect(bundleSaving(ceBundle({ format: "posters" }))).toBeNull();
  });

  it("is null for a Coming Soon bundle, which has no price", () => {
    expect(bundleSaving(ceBundle({ state: "coming-soon", priceFrom: null }))).toBeNull();
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
