import { describe, expect, it } from "vitest";

import { productsHref } from "./product-filters";
import { parseProductSearchParams, productsQueryOf } from "./product-search-params";

const CONTEXT = {
  examCodes: ["CE", "ME", "EE", "MT", "CPA"],
  memberAppLive: false,
  priceBounds: { min: 400, max: 1200 },
};

/** The search params Next.js passes a page for this Products URL. */
function searchParamsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://localhost").searchParams);
}

describe("parseProductSearchParams", () => {
  it("reads every filter from the URL", () => {
    expect(
      parseProductSearchParams(
        { exam: "ce", format: "posters", q: "MSTC", sort: "price-asc", max: "500", app: "1" },
        { ...CONTEXT, memberAppLive: true },
      ),
    ).toEqual({
      examCode: "CE",
      format: "posters",
      query: "MSTC",
      sort: "price-asc",
      maxPrice: 50000,
      maxPesos: 500,
      availableInApp: true,
    });
  });

  it("is empty for the plain Products page", () => {
    expect(parseProductSearchParams({}, CONTEXT)).toEqual({});
  });

  it("ignores invalid values instead of throwing", () => {
    expect(
      parseProductSearchParams(
        { exam: "zzz", format: "box", max: "abc", sort: "bogus", q: "" },
        CONTEXT,
      ),
    ).toEqual({});
  });

  it("matches the Exam code in any case", () => {
    expect(parseProductSearchParams({ exam: "Cpa" }, CONTEXT)).toEqual({ examCode: "CPA" });
  });

  it("trims the search, ignores a blank one and keeps at most 100 characters", () => {
    expect(parseProductSearchParams({ q: "  flash  " }, CONTEXT)).toEqual({ query: "flash" });
    expect(parseProductSearchParams({ q: "   " }, CONTEXT)).toEqual({});
    expect(parseProductSearchParams({ q: "x".repeat(150) }, CONTEXT).query).toHaveLength(100);
  });

  it("leaves out the default sort", () => {
    expect(parseProductSearchParams({ sort: "best-selling" }, CONTEXT)).toEqual({});
  });

  it("reads max as whole pesos within the price bounds", () => {
    expect(parseProductSearchParams({ max: "400" }, CONTEXT)).toEqual({
      maxPrice: 40000,
      maxPesos: 400,
    });
    expect(parseProductSearchParams({ max: "1150" }, CONTEXT)).toMatchObject({ maxPesos: 1150 });
  });

  it('reads max at or above the top bound as "Any"', () => {
    expect(parseProductSearchParams({ max: "1200" }, CONTEXT)).toEqual({});
    expect(parseProductSearchParams({ max: "99999" }, CONTEXT)).toEqual({});
  });

  it("ignores a max below the bottom bound, negative or not a whole number", () => {
    for (const max of ["350", "-500", "500.5", "5e2", " 500", ""]) {
      expect(parseProductSearchParams({ max }, CONTEXT)).toEqual({});
    }
  });

  it("ignores app=1 while the Member App switch is off", () => {
    expect(parseProductSearchParams({ app: "1" }, CONTEXT)).toEqual({});
    expect(parseProductSearchParams({ app: "yes" }, { ...CONTEXT, memberAppLive: true })).toEqual(
      {},
    );
  });

  it("takes the first of a repeated key", () => {
    expect(parseProductSearchParams({ format: ["bundle", "posters"] }, CONTEXT)).toEqual({
      format: "bundle",
    });
  });
});

describe("productsQueryOf", () => {
  it("round-trips every filter through the URL", () => {
    const context = { ...CONTEXT, memberAppLive: true };
    for (const href of [
      "/products",
      "/products?exam=ce",
      "/products?exam=mt&format=bundle&q=clin+chem&sort=top-rated&max=600&app=1",
      "/products?format=posters&sort=price-desc",
      "/products?q=ce+posters+%26+more&max=400",
    ]) {
      const filters = parseProductSearchParams(searchParamsOf(href), context);
      expect(productsHref(productsQueryOf(filters))).toBe(href);
    }
  });

  it("canonicalises a messy URL to the one URL for its filters", () => {
    const filters = parseProductSearchParams(
      searchParamsOf("/products?sort=best-selling&q=+mstc+&exam=CE&max=5000&format=box"),
      CONTEXT,
    );
    expect(productsHref(productsQueryOf(filters))).toBe("/products?exam=ce&q=mstc");
  });
});
