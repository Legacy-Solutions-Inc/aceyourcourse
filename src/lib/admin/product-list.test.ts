import { describe, expect, it } from "vitest";

import type { AdminProductRow } from "@/services/admin.types";

import {
  adminPriceLabel,
  formatAndSold,
  parseProductListParams,
  productLinkCount,
  productListHref,
} from "./product-list";

const row = (overrides: Partial<AdminProductRow> = {}): AdminProductRow => ({
  id: "prd-005",
  slug: "ultimate-ce-posters-2-0",
  title: "Ultimate Civil Engineering Posters",
  shortName: "Ultimate CE Posters 2.0",
  examCode: "CE",
  format: "posters",
  state: "live",
  priceFrom: 40000,
  priceTo: 125000,
  unitsSold: 172,
  cover: null,
  storeLinks: { shopee: "product", lazada: "shop", tiktok: "shop" },
  showOnWebsite: true,
  availableInApp: false,
  stamp: { savedAt: "2026-10-22T03:42:00.000Z", savedBy: null },
  ...overrides,
});

describe("parseProductListParams", () => {
  it("reads no filters and no selection from an empty URL", () => {
    expect(parseProductListParams({})).toEqual({ query: {}, product: null });
  });

  it("reads the search, Exam, Missing product links and the selected Product", () => {
    expect(
      parseProductListParams({ q: "poster", exam: "ce", missing: "1", product: "prd-005" }),
    ).toEqual({ query: { q: "poster", exam: "ce", missing: true }, product: "prd-005" });
  });

  it("reads a new Product as product=new", () => {
    expect(parseProductListParams({ product: "new" }).product).toBe("new");
  });

  it("takes the first of a repeated value", () => {
    expect(parseProductListParams({ q: ["a", "b"] }).query.q).toBe("a");
  });

  it("ignores Missing product links unless it's 1, and a blank selection", () => {
    expect(parseProductListParams({ missing: "yes", product: " " })).toEqual({
      query: {},
      product: null,
    });
  });

  it("keeps the search to 100 characters", () => {
    expect(parseProductListParams({ q: "x".repeat(150) }).query.q).toHaveLength(100);
  });
});

describe("productListHref", () => {
  const none = { q: null, exam: null, missing: false };

  it("is the bare Products path with no filters and no selection", () => {
    expect(productListHref(none)).toBe("/admin/products");
  });

  it("writes the filters, with the Exam in lowercase, then the selection", () => {
    expect(productListHref({ q: "ce posters", exam: "CE", missing: true }, "prd-005")).toBe(
      "/admin/products?q=ce+posters&exam=ce&missing=1&product=prd-005",
    );
  });

  it("selects a new Product", () => {
    expect(productListHref(none, "new")).toBe("/admin/products?product=new");
  });
});

describe("adminPriceLabel", () => {
  it("adds + to a price range's lowest price", () => {
    expect(adminPriceLabel(row())).toBe("₱400+");
  });

  it("shows a single price as it is", () => {
    expect(adminPriceLabel(row({ priceFrom: 120000, priceTo: null }))).toBe("₱1,200");
    expect(adminPriceLabel(row({ priceFrom: 120000, priceTo: 120000 }))).toBe("₱1,200");
  });

  it("shows COMING SOON, with no price, for a Coming Soon Product", () => {
    expect(adminPriceLabel(row({ state: "coming-soon", priceFrom: null, priceTo: null }))).toBe(
      "COMING SOON",
    );
  });
});

describe("formatAndSold", () => {
  it("gives the format and units sold: FLASH CARDS · 764 SOLD", () => {
    expect(formatAndSold(row({ format: "flash-cards", unitsSold: 764 }))).toBe(
      "FLASH CARDS · 764 SOLD",
    );
  });

  it("groups thousands", () => {
    expect(formatAndSold(row({ unitsSold: 1820 }))).toBe("POSTERS · 1,820 SOLD");
  });

  it("gives the format alone for a Product with no units sold", () => {
    expect(formatAndSold(row({ format: "notebook", unitsSold: null }))).toBe("NOTEBOOK");
  });
});

describe("productLinkCount", () => {
  it("counts the Marketplaces with a product link", () => {
    expect(productLinkCount(row().storeLinks)).toBe(1);
    expect(productLinkCount({ shopee: "product", lazada: "product", tiktok: "product" })).toBe(3);
    expect(productLinkCount({ shopee: "none", lazada: "shop", tiktok: "none" })).toBe(0);
  });
});
