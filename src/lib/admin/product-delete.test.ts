import { describe, expect, it } from "vitest";

import { productDeleteCopy } from "./product-delete";

describe("productDeleteCopy", () => {
  it("names the Product and gives exact counts of what goes with it (mockup 1569)", () => {
    expect(
      productDeleteCopy("Ultimate CE Posters 2.0", "CE", { reviews: 3, photos: 4, faqQuotes: 1 }),
    ).toEqual({
      title: "Delete “Ultimate CE Posters 2.0”?",
      body: [
        "It disappears from the website, the Products page, and the CE exam page.",
        "3 Reviews and 4 photos are deleted with it.",
        "1 FAQ quote from its Reviews is removed.",
        "Store listings on Shopee, Lazada, and TikTok Shop are not affected.",
        "This can’t be undone.",
      ].join(" "),
    });
  });

  it("counts one of each in the singular, and several FAQ quotes in the plural", () => {
    expect(
      productDeleteCopy("MT Notebook", "MT", { reviews: 1, photos: 1, faqQuotes: 2 }).body,
    ).toContain(
      "1 Review and 1 photo are deleted with it. 2 FAQ quotes from its Reviews are removed.",
    );
  });

  it("says nothing else goes when it has no Reviews, photos or FAQ quotes", () => {
    const { body } = productDeleteCopy("MT Notebook", "MT", {
      reviews: 0,
      photos: 0,
      faqQuotes: 0,
    });
    expect(body).toBe(
      [
        "It disappears from the website, the Products page, and the MT exam page.",
        "No Reviews or photos are deleted with it.",
        "Store listings on Shopee, Lazada, and TikTok Shop are not affected.",
        "This can’t be undone.",
      ].join(" "),
    );
  });

  it("still gives both counts when only one of them is 0", () => {
    expect(
      productDeleteCopy("CE Bundle", "CE", { reviews: 0, photos: 2, faqQuotes: 0 }).body,
    ).toContain("0 Reviews and 2 photos are deleted with it.");
  });
});
