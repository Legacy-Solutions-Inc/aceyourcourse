import { describe, expect, it } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import { examStats } from "./exam-stats";

// The Exam page hero's stats (docs/mockup/website/Exam_v2.dc.html L252–263),
// computed from Live Products only: Coming Soon Products aren't for sale, so
// they're left out of every count, total, average and price.

const cards = testLiveProduct({
  id: "cards",
  priceFrom: 120000,
  shopee: { rating: 4.8, ratingCount: 197, unitsSold: 764, asOf: "2026-10-29" },
});
const posters = testLiveProduct({
  id: "posters",
  format: "posters",
  priceFrom: 40000,
  priceTo: 125000,
  shopee: { rating: 4.9, ratingCount: 52, unitsSold: 172, asOf: "2026-10-29" },
});
const bundle = testLiveProduct({
  id: "bundle",
  format: "bundle",
  priceFrom: 120000,
  priceTo: 349900,
  shopee: { rating: 4.5, ratingCount: 6, unitsSold: 16, asOf: "2026-10-29" },
});
const soonNotebook = testComingSoonProduct({ id: "notebook" });

describe("examStats", () => {
  it("counts the Live Products, sums their units sold and finds the lowest price", () => {
    const stats = examStats([cards, posters, bundle]);
    expect(stats.productCount).toBe(3);
    expect(stats.unitsSold).toBe(952);
    expect(stats.priceFrom).toBe(40000);
  });

  it("weights the average rating by each Product's number of ratings, to one decimal", () => {
    // (4.8 × 197 + 4.9 × 52 + 4.5 × 6) / 255 = 4.813…; a plain mean would be 4.73.
    expect(examStats([cards, posters, bundle]).averageRating).toBe(4.8);
    // (4.5 × 6 + 4.9 × 2) / 8 = 4.6; a plain mean would be 4.7.
    const fewRatings = testLiveProduct({
      id: "few",
      shopee: { rating: 4.9, ratingCount: 2, unitsSold: 3, asOf: "2026-10-29" },
    });
    expect(examStats([bundle, fewRatings]).averageRating).toBe(4.6);
  });

  it("ignores Coming Soon Products entirely", () => {
    // A Coming Soon Product never has figures or a price, but even one that
    // did must not move the stats.
    const soonWithFigures = testComingSoonProduct({
      id: "soon-with-figures",
      priceFrom: 100,
      shopee: { rating: 1, ratingCount: 1000, unitsSold: 1000, asOf: "2026-10-29" },
    });
    expect(examStats([cards, posters, bundle, soonNotebook, soonWithFigures])).toEqual(
      examStats([cards, posters, bundle]),
    );
  });

  it("has no average rating when no Live Product has a rating yet", () => {
    const unrated = testLiveProduct({
      id: "unrated",
      shopee: { rating: 0, ratingCount: 0, unitsSold: 4, asOf: "2026-10-29" },
    });
    const stats = examStats([unrated]);
    expect(stats.averageRating).toBeNull();
    expect(stats.unitsSold).toBe(4);
  });

  it("counts a Product without Shopee figures toward the number and the price only", () => {
    const noFigures = testLiveProduct({ id: "no-figures", priceFrom: 30000, shopee: null });
    expect(examStats([cards, noFigures])).toEqual({
      productCount: 2,
      unitsSold: 764,
      averageRating: 4.8,
      priceFrom: 30000,
    });
    expect(examStats([noFigures]).averageRating).toBeNull();
  });

  it("has nothing to count, total or price with only Coming Soon Products", () => {
    expect(examStats([soonNotebook])).toEqual({
      productCount: 0,
      unitsSold: 0,
      averageRating: null,
      priceFrom: null,
    });
    expect(examStats([])).toEqual(examStats([soonNotebook]));
  });
});
