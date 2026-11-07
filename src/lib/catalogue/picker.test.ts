import { describe, expect, it } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import { recommendProduct } from "./picker";

// "Help me choose": one Live Product of the picked Exam for the picked study
// style, with the mockup's reasons (docs/mockup/website/Products_v2.dc.html
// L153–158 and L184–190). The Products come in best-seller order, as
// listProducts() returns them.

const ceCards = testLiveProduct({
  id: "ce-cards",
  shortName: "CE Formula Flash Cards",
  format: "flash-cards",
  availableInApp: false,
});
const cePosters = testLiveProduct({
  id: "ce-posters",
  shortName: "Ultimate CE Posters 2.0",
  format: "posters",
  availableInApp: true,
});
const ceBundle = testLiveProduct({
  id: "ce-bundle",
  shortName: "CE Review Bundle",
  format: "bundle",
  availableInApp: false,
});
const meCards = testLiveProduct({
  id: "me-cards",
  examCode: "ME",
  shortName: "ME Formula Flash Cards",
  format: "flash-cards",
  availableInApp: true,
});
const ceSoonNotebook = testComingSoonProduct({ id: "ce-notebook", format: "notebook" });
const eeSoonPosters = testComingSoonProduct({
  id: "ee-posters",
  examCode: "EE",
  format: "posters",
});

const bestSellers = [ceCards, meCards, cePosters, ceSoonNotebook, ceBundle, eeSoonPosters];

describe("recommendProduct", () => {
  it("recommends the Exam's Product in the style's first-choice format, with its reason", () => {
    expect(recommendProduct(bestSellers, "CE", "on-my-wall")).toEqual({
      product: cePosters,
      reason:
        "Posters keep every formula in view while you solve. Where there are no posters for your board, flash cards are the closest fit.",
    });
    expect(recommendProduct(bestSellers, "CE", "on-the-go")).toEqual({
      product: ceCards,
      reason:
        "Flash cards fit in a bag or pocket, so you can drill formulas between classes or on the commute.",
    });
    expect(recommendProduct(bestSellers, "CE", "everything")).toEqual({
      product: ceBundle,
      reason:
        "The bundle covers every format in one order and costs less than buying each separately.",
    });
  });

  it("falls back to the next preferred format, and says it's the closest fit", () => {
    expect(recommendProduct(bestSellers, "ME", "on-my-wall")).toEqual({
      product: meCards,
      reason: "For ME, the ME Formula Flash Cards is the closest fit.",
    });
  });

  it("never recommends a Coming Soon Product, even in the preferred format", () => {
    expect(recommendProduct(bestSellers, "CE", "solving")).toEqual({
      product: ceCards,
      reason: "For CE, the CE Formula Flash Cards is the closest fit.",
    });
  });

  it("falls back to the Exam's best seller when no preferred format is out", () => {
    const postersOnly = [
      testLiveProduct({ id: "a", examCode: "MT", shortName: "MT Posters A", format: "posters" }),
      testLiveProduct({ id: "b", examCode: "MT", shortName: "MT Posters B", format: "posters" }),
    ];
    expect(recommendProduct(postersOnly, "MT", "solving")?.product.id).toBe("a");
  });

  it("is null for an Exam with only Coming Soon Products, or none", () => {
    expect(recommendProduct(bestSellers, "EE", "on-my-wall")).toBeNull();
    expect(recommendProduct(bestSellers, "CPA", "on-the-go")).toBeNull();
    expect(recommendProduct([], "CE", "everything")).toBeNull();
  });

  it("matches the Exam code in any case", () => {
    expect(recommendProduct(bestSellers, "ce", "on-my-wall")?.product).toBe(cePosters);
  });

  describe("with the Member App switch on", () => {
    const appLive = { memberAppLive: true };

    it("adds that a closest-fit Product is also in the app", () => {
      expect(recommendProduct(bestSellers, "ME", "on-my-wall", appLive)?.reason).toBe(
        "For ME, the ME Formula Flash Cards is the closest fit. It’s also in the app.",
      );
      expect(recommendProduct(bestSellers, "CE", "solving", appLive)?.reason).toBe(
        "For CE, the CE Formula Flash Cards is the closest fit.",
      );
    });

    it('recommends the best-selling Product in the app for "App"', () => {
      expect(recommendProduct(bestSellers, "CE", "app", appLive)).toEqual({
        product: cePosters,
        reason:
          "The app has digital flash cards, quizzes, reviewer PDFs, and video lessons for this exam, with a countdown to your exam date.",
      });
    });

    it("falls back to the best seller, without an app claim, when none of the Exam is in the app", () => {
      const printedOnly = [ceCards, ceBundle];
      expect(recommendProduct(printedOnly, "CE", "app", appLive)).toEqual({
        product: ceCards,
        reason: "For CE, the CE Formula Flash Cards is the closest fit.",
      });
    });
  });

  it("never mentions the app while the Member App switch is off", () => {
    expect(recommendProduct(bestSellers, "ME", "on-my-wall")?.reason).not.toMatch(/app/i);
    expect(recommendProduct(bestSellers, "CE", "app")).toBeNull();
  });
});
