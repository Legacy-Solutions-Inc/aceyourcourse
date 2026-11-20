import { describe, expect, it } from "vitest";

import {
  DEFAULT_ZOOM,
  isReaderZoom,
  openingPlace,
  pageFromAddress,
  READER_ZOOMS,
  zoomIn,
  zoomOut,
} from "@/lib/reviewer-pdfs/reader";

// The Reviewer PDF reader's rules (ticket 14; spec, Phase 3 → Reviewer PDF
// reader, Resume): zoom 75–150% in 25% steps, and where it opens.

describe("zoom", () => {
  it("goes from 75% to 150% in 25% steps, starting at 100%", () => {
    expect(READER_ZOOMS).toEqual([75, 100, 125, 150]);
    expect(DEFAULT_ZOOM).toBe(100);
  });

  it("steps in and out one step at a time", () => {
    expect(zoomIn(75)).toBe(100);
    expect(zoomIn(125)).toBe(150);
    expect(zoomOut(150)).toBe(125);
    expect(zoomOut(100)).toBe(75);
  });

  it("stays put at either end", () => {
    expect(zoomIn(150)).toBe(150);
    expect(zoomOut(75)).toBe(75);
  });

  it("knows a zoom from a number that isn't one", () => {
    expect(isReaderZoom(125)).toBe(true);
    for (const value of [50, 110, 175, 0, Number.NaN]) expect(isReaderZoom(value)).toBe(false);
  });
});

describe("openingPlace", () => {
  it("reopens where the Member left it, at their zoom", () => {
    expect(openingPlace({ page: 7, zoom: 125 }, 12)).toEqual({ page: 7, zoom: 125 });
  });

  it("opens at page 1, 100%, the first time", () => {
    expect(openingPlace(null, 12)).toEqual({ page: 1, zoom: 100 });
  });

  it("opens at its last page when it has fewer pages than the one they left at", () => {
    expect(openingPlace({ page: 30, zoom: 75 }, 12)).toEqual({ page: 12, zoom: 75 });
  });
});

describe("pageFromAddress", () => {
  it("reads a page number as an address gives it", () => {
    expect(pageFromAddress("1")).toBe(1);
    expect(pageFromAddress("36")).toBe(36);
  });

  it.each(["0", "-1", "1.5", "two", "01", "", " 2", "1e3", "9999999"])(
    "reads %j as no page",
    (text) => {
      expect(pageFromAddress(text)).toBeNull();
    },
  );
});
