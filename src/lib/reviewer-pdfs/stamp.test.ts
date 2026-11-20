import { describe, expect, it } from "vitest";

import { PAGE_WIDTH } from "@/lib/reviewer-pdfs/job";
import { pangoText, STAMP_ROWS, stampLayout, stampText } from "@/lib/reviewer-pdfs/stamp";

// The stamp burned into each Reviewer PDF page a Member reads (ticket 14;
// spec, Phase 3 → Burned-in watermark): what it says, and where it goes.

describe("stampText", () => {
  it("is the Member's email and short Member ID", () => {
    expect(stampText({ email: "tester@example.com", memberId: "3F1A5C2E" })).toBe(
      "tester@example.com · 3F1A5C2E",
    );
  });
});

describe("pangoText", () => {
  it("escapes what the text renderer would read as markup", () => {
    expect(pangoText(`a&b<i>"x'@example.com`)).toBe("a&amp;b&lt;i&gt;&quot;x&apos;@example.com");
  });

  it("leaves an ordinary stamp as it is", () => {
    expect(pangoText("tester@example.com · 3F1A5C2E")).toBe("tester@example.com · 3F1A5C2E");
  });
});

describe("stampLayout", () => {
  it("puts six rows down a full-size page, evenly, each inside it", () => {
    const height = 2071;
    const { fontPx, lineHeight, rowTops } = stampLayout(PAGE_WIDTH, height);

    expect(fontPx).toBe(33);
    expect(lineHeight).toBe(47);
    expect(rowTops).toHaveLength(STAMP_ROWS);
    expect(rowTops[0]).toBeGreaterThan(0);
    expect((rowTops.at(-1) ?? 0) + lineHeight).toBeLessThan(height);
    const gaps = rowTops.slice(1).map((top, index) => top - (rowTops[index] ?? 0));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    // Clear page between the rows, so the stamp never hides much of it.
    expect(Math.min(...gaps)).toBeGreaterThan(lineHeight * 5);
  });

  it("is the same every time for the same page size", () => {
    expect(stampLayout(800, 1035)).toEqual(stampLayout(800, 1035));
  });

  it("scales the text with the page, within readable bounds", () => {
    expect(stampLayout(800, 1035).fontPx).toBe(17);
    expect(stampLayout(160, 207).fontPx).toBe(10);
    expect(stampLayout(16, 21).fontPx).toBe(10);
    expect(stampLayout(6000, 7765).fontPx).toBe(40);
  });

  it("leaves a gap of three letters between repeats along a row", () => {
    expect(stampLayout(800, 1035).gap).toBe(51);
  });
});
