import { describe, expect, it } from "vitest";

import { fullTitle, SEO_PAGE_TITLE_MAX, seoCheck } from "./seo-check";

// "Search & AI visibility" (spec, Phase 2 → Exam pages & promo; BUILD-MAP
// §3.2): GOOD when the whole <title>, with the " · Ace Your Course" the root
// layout adds, is at most 60 characters and the description is 80–160.

/** A page title whose whole <title> is `length` characters long. */
const titleOfFull = (length: number) => "T".repeat(length - " · Ace Your Course".length);
const description = (length: number) => "d".repeat(length);

describe("fullTitle", () => {
  it("adds the site name, as the root layout's title template does", () => {
    expect(fullTitle("CE Board Exam Reviewer")).toBe("CE Board Exam Reviewer · Ace Your Course");
  });

  it("leaves 42 characters for the page's own title", () => {
    expect(SEO_PAGE_TITLE_MAX).toBe(42);
    expect(fullTitle(titleOfFull(60))).toHaveLength(60);
  });
});

describe("seoCheck", () => {
  it.each([59, 60])("is good with a %i-character whole title", (length) => {
    expect(seoCheck({ title: titleOfFull(length), description: description(120) })).toBe("good");
  });

  it("checks a 61-character whole title", () => {
    expect(seoCheck({ title: titleOfFull(61), description: description(120) })).toBe("check");
  });

  it.each([80, 160])("is good with a %i-character description", (length) => {
    expect(seoCheck({ title: titleOfFull(50), description: description(length) })).toBe("good");
  });

  it.each([79, 161, 70, 0])("checks a %i-character description", (length) => {
    expect(seoCheck({ title: titleOfFull(50), description: description(length) })).toBe("check");
  });

  it("counts the description as it's shown, without the space around it", () => {
    expect(seoCheck({ title: "CE", description: `  ${description(80)}\n` })).toBe("good");
    expect(seoCheck({ title: "CE", description: ` ${description(79)} ` })).toBe("check");
  });
});
