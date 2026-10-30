import { describe, expect, it } from "vitest";

import { productsPageCopy } from "./products-page";

const { hero, all } = productsPageCopy;

describe("the Products page hero's app sentence", () => {
  it('says "Most" when more than half of the Live Products are in the app', () => {
    expect(hero.appSentence(5, 8)).toBe("Most are also in the app.");
    expect(hero.appSentence(1, 1)).toBe("Most are also in the app.");
  });

  it('says "Some" when at least one is, up to exactly half', () => {
    expect(hero.appSentence(4, 8)).toBe("Some are also in the app.");
    expect(hero.appSentence(1, 8)).toBe("Some are also in the app.");
  });

  it("says nothing when none are", () => {
    expect(hero.appSentence(0, 8)).toBeNull();
    expect(hero.appSentence(0, 0)).toBeNull();
  });
});

describe("the Products page counts", () => {
  it("names the number of board exams", () => {
    expect(hero.pill(5)).toBe("All reviewers · 5 board exams");
    expect(hero.pill(1)).toBe("All reviewers · 1 board exam");
  });

  it('reads "N of M reviewers"', () => {
    expect(all.count(3, 8)).toBe("3 of 8 reviewers");
  });
});
