import { describe, expect, it } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import { facetCounts, priceBoundsOf, productsHref } from "./product-filters";

describe("productsHref", () => {
  it("is the plain Products page with no filters", () => {
    expect(productsHref({})).toBe("/products");
  });

  it("adds a single filter", () => {
    expect(productsHref({ format: "posters" })).toBe("/products?format=posters");
  });

  it("lowercases the Exam code", () => {
    expect(productsHref({ exam: "CE" })).toBe("/products?exam=ce");
  });

  it("omits the default sort", () => {
    expect(productsHref({ sort: "best-selling" })).toBe("/products");
    expect(productsHref({ sort: "price-asc" })).toBe("/products?sort=price-asc");
  });

  it("writes every key in a fixed order, whatever order they are given in", () => {
    expect(
      productsHref({
        app: true,
        max: 600,
        sort: "top-rated",
        q: "flash",
        format: "bundle",
        exam: "MT",
      }),
    ).toBe("/products?exam=mt&format=bundle&q=flash&sort=top-rated&max=600&app=1");
  });

  it("encodes the search and drops a blank one", () => {
    expect(productsHref({ q: "ce posters & more" })).toBe("/products?q=ce+posters+%26+more");
    expect(productsHref({ q: "   " })).toBe("/products");
  });

  it("drops the app filter when it is off", () => {
    expect(productsHref({ app: false })).toBe("/products");
  });
});

describe("priceBoundsOf", () => {
  it("rounds the lowest price down and the highest up to the nearest ₱50", () => {
    expect(
      priceBoundsOf([
        testLiveProduct({ priceFrom: 69900 }),
        testLiveProduct({ priceFrom: 42000 }),
        testLiveProduct({ priceFrom: 120100 }),
      ]),
    ).toEqual({ min: 400, max: 1250 });
  });

  it("keeps prices already on a ₱50 step", () => {
    expect(
      priceBoundsOf([
        testLiveProduct({ priceFrom: 40000 }),
        testLiveProduct({ priceFrom: 120000 }),
      ]),
    ).toEqual({ min: 400, max: 1200 });
  });

  it("never counts a Coming Soon Product", () => {
    expect(
      priceBoundsOf([
        testLiveProduct({ priceFrom: 60000 }),
        testComingSoonProduct(),
        testComingSoonProduct({ priceFrom: 0 }),
      ]),
    ).toEqual({ min: 600, max: 600 });
  });

  it("is zero to zero with no Live Products", () => {
    expect(priceBoundsOf([testComingSoonProduct()])).toEqual({ min: 0, max: 0 });
  });
});

describe("facetCounts", () => {
  const products = [
    testLiveProduct({ examCode: "CE", format: "flash-cards" }),
    testLiveProduct({ examCode: "CE", format: "posters" }),
    testLiveProduct({ examCode: "CE", format: "bundle" }),
    testLiveProduct({ examCode: "ME", format: "flash-cards" }),
    testLiveProduct({ examCode: "MT", format: "notebook" }),
  ];

  it("counts every Live Product per Exam and per format", () => {
    expect(facetCounts(products)).toEqual({
      all: 5,
      exams: { CE: 3, ME: 1, MT: 1 },
      formats: { "flash-cards": 2, posters: 1, notebook: 1, bundle: 1 },
    });
  });

  it("counts formats within the selected Exam, and Exams over every Exam", () => {
    expect(facetCounts(products, "ce")).toEqual({
      all: 5,
      exams: { CE: 3, ME: 1, MT: 1 },
      formats: { "flash-cards": 1, posters: 1, notebook: 0, bundle: 1 },
    });
  });

  it("gives a format with no Products a count of 0", () => {
    expect(facetCounts(products, "ME").formats).toEqual({
      "flash-cards": 1,
      posters: 0,
      notebook: 0,
      bundle: 0,
    });
  });

  it("never counts a Coming Soon Product", () => {
    expect(facetCounts([...products, testComingSoonProduct({ examCode: "EE" })])).toMatchObject({
      all: 5,
      exams: { CE: 3, ME: 1, MT: 1 },
    });
  });
});
