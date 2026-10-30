import { describe, expect, it } from "vitest";

import { formatAsOf, formatDate, manilaYear } from "./manila-time";

// All day boundaries use Asia/Manila (UTC+8, no DST).
describe("formatAsOf", () => {
  it("formats an ISO date as a short month and year", () => {
    expect(formatAsOf("2026-10-29")).toBe("as of Oct 2026");
  });

  it("uses the Manila month for a timestamp that is already the next month in Manila", () => {
    // 20:00 UTC on Oct 31 is 04:00 on Nov 1 in Manila.
    expect(formatAsOf("2026-10-31T20:00:00Z")).toBe("as of Nov 2026");
  });

  it("rejects a string that is not a date", () => {
    expect(() => formatAsOf("not-a-date")).toThrow(RangeError);
  });

  it("rejects an empty string", () => {
    expect(() => formatAsOf("")).toThrow(RangeError);
  });
});

describe("formatDate", () => {
  it("formats an ISO date day first, with a short month by default", () => {
    expect(formatDate("2026-12-01")).toBe("1 Dec 2026");
  });

  it("can spell the month out", () => {
    expect(formatDate("2026-12-01", "long")).toBe("1 December 2026");
  });

  it("uses the Manila day for a timestamp that is already the next day in Manila", () => {
    // 17:00 UTC on Nov 30 is 01:00 on Dec 1 in Manila.
    expect(formatDate("2026-11-30T17:00:00Z")).toBe("1 Dec 2026");
  });

  it("rejects a string that is not a date", () => {
    expect(() => formatDate("2026-13-40")).toThrow(RangeError);
  });
});

describe("manilaYear", () => {
  it("returns the year in Manila", () => {
    expect(manilaYear(new Date("2026-10-29T04:00:00Z"))).toBe(2026);
  });

  it("rolls over at Manila midnight, before UTC does", () => {
    // 16:30 UTC on Dec 31 is 00:30 on Jan 1 in Manila.
    expect(manilaYear(new Date("2026-12-31T16:30:00Z"))).toBe(2027);
  });

  it("is still the old year one minute before Manila midnight", () => {
    expect(manilaYear(new Date("2026-12-31T15:59:00Z"))).toBe(2026);
  });
});
