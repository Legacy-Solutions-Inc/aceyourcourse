import { describe, expect, it } from "vitest";

import { productsHref } from "./product-filters";

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
