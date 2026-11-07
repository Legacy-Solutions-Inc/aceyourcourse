import { describe, expect, it } from "vitest";

import { testLiveProduct } from "../../../test/fixtures/catalogue";
import { figuresAsOf, soldBarPercent } from "./best-sellers";

// The Home Best sellers' sold bar (docs/mockup/website/Home_v2.dc.html L341):
// each Product's units sold as a share of the #1 seller's.

const sold = (id: string, unitsSold: number) =>
  testLiveProduct({ id, shopee: { rating: 4.8, ratingCount: 10, unitsSold, asOf: "2026-10-29" } });

const top = sold("top", 764);

describe("soldBarPercent", () => {
  it("gives the top seller a full bar", () => {
    expect(soldBarPercent(top, top)).toBe(100);
  });

  it("rounds another seller's share of the top seller's units to a whole percent", () => {
    // 404 / 764 = 52.88…%; 16 / 764 = 2.09…%.
    expect(soldBarPercent(sold("me", 404), top)).toBe(53);
    expect(soldBarPercent(sold("bundle", 16), top)).toBe(2);
  });

  it("clamps to 0–100", () => {
    expect(soldBarPercent(sold("more", 900), top)).toBe(100);
    expect(soldBarPercent(sold("negative", -5), top)).toBe(0);
  });

  it("is 0 when the top seller has sold nothing", () => {
    const none = sold("none", 0);
    expect(soldBarPercent(none, none)).toBe(0);
    expect(soldBarPercent(sold("some", 12), none)).toBe(0);
  });

  it("is 0 without Shopee figures", () => {
    const noFigures = testLiveProduct({ id: "no-figures", shopee: null });
    expect(soldBarPercent(noFigures, top)).toBe(0);
    expect(soldBarPercent(top, noFigures)).toBe(0);
  });
});

describe("figuresAsOf", () => {
  const copiedOn = (id: string, asOf: string) =>
    testLiveProduct({ id, shopee: { rating: 4.8, ratingCount: 10, unitsSold: 10, asOf } });

  it("is the oldest date the Products' figures were copied, so none is newer than it says", () => {
    expect(
      figuresAsOf([
        copiedOn("a", "2026-10-29"),
        copiedOn("b", "2026-09-15"),
        copiedOn("c", "2026-10-01"),
      ]),
    ).toBe("2026-09-15");
  });

  it("skips Products without figures, and is null when none has them", () => {
    const noFigures = testLiveProduct({ id: "none", shopee: null });
    expect(figuresAsOf([noFigures, copiedOn("a", "2026-10-29")])).toBe("2026-10-29");
    expect(figuresAsOf([noFigures])).toBeNull();
    expect(figuresAsOf([])).toBeNull();
  });
});
