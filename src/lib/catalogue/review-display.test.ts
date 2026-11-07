import { describe, expect, it } from "vitest";

import { reviewDisplayMode } from "./review-display";

// How the Exam page shows its Reviews (docs/mockup/website/Exam_v2.dc.html
// L260, L267): enough to fill a scrolling marquee, a few in a grid, or none.

describe("reviewDisplayMode", () => {
  it("scrolls 4 or more Reviews in a marquee", () => {
    expect(reviewDisplayMode(4)).toBe("marquee");
    expect(reviewDisplayMode(7)).toBe("marquee");
  });

  it("lays 1 to 3 Reviews out in a grid", () => {
    expect(reviewDisplayMode(3)).toBe("grid");
    expect(reviewDisplayMode(1)).toBe("grid");
  });

  it("shows the empty message with no Reviews", () => {
    expect(reviewDisplayMode(0)).toBe("empty");
  });
});
