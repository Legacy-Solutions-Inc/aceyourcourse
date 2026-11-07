import { describe, expect, it } from "vitest";

import type { ShopStats } from "@/services/catalogue.types";

import { aboutStats } from "./about-stats";

// The About hero's stat tiles, computed in place of the mockup's hardcoded
// "29 reviewers · 11 board exams" (About_v2.dc.html L172).

const SHOP: ShopStats = { rating: 4.8, ratingCount: 874, followers: "3.7K", asOf: "2026-10-29" };

const tiles = (input: Partial<Parameters<typeof aboutStats>[0]> = {}) =>
  aboutStats({ productTotal: 8, examCount: 5, shopStats: SHOP, ...input });

describe("aboutStats", () => {
  it("gives the Products, the Exams, the shop rating and the followers, in that order", () => {
    expect(tiles()).toEqual([
      { id: "products", value: "8", label: "reviewers" },
      { id: "exams", value: "5", label: "board exams" },
      { id: "rating", value: "4.8", label: "874 shop ratings" },
      { id: "followers", value: "3.7K", label: "Shopee followers" },
    ]);
  });

  it("groups large counts and shows the rating to one decimal place", () => {
    const [products, , rating] = tiles({
      productTotal: 1200,
      shopStats: { ...SHOP, rating: 5, ratingCount: 12345 },
    });
    expect(products).toMatchObject({ value: "1,200" });
    expect(rating).toMatchObject({ value: "5.0", label: "12,345 shop ratings" });
  });

  it("says one reviewer, one board exam and one shop rating in the singular", () => {
    expect(
      tiles({ productTotal: 1, examCount: 1, shopStats: { ...SHOP, ratingCount: 1 } }).map(
        (tile) => tile.label,
      ),
    ).toEqual(["reviewer", "board exam", "1 shop rating", "Shopee followers"]);
  });

  it("shows no 0 tile for an empty catalogue", () => {
    expect(tiles({ productTotal: 0, examCount: 0 }).map((tile) => tile.id)).toEqual([
      "rating",
      "followers",
    ]);
  });

  it("skips the rating tile with no rating or no ratings", () => {
    for (const shopStats of [
      { ...SHOP, rating: 0 },
      { ...SHOP, ratingCount: 0 },
      { ...SHOP, rating: Number.NaN },
    ]) {
      expect(
        tiles({ shopStats }).map((tile) => tile.id),
        JSON.stringify(shopStats),
      ).toEqual(["products", "exams", "followers"]);
    }
  });

  it("skips the followers tile when the figure is missing or 0", () => {
    for (const followers of ["", "  ", "0"]) {
      expect(
        tiles({ shopStats: { ...SHOP, followers } }).map((tile) => tile.id),
        JSON.stringify(followers),
      ).toEqual(["products", "exams", "rating"]);
    }
  });

  it("trims the followers figure as entered", () => {
    expect(tiles({ shopStats: { ...SHOP, followers: " 12K " } })[3]).toMatchObject({
      value: "12K",
    });
  });
});
