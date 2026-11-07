import { describe, expect, it } from "vitest";

import {
  formatAsOf,
  formatDate,
  isCalendarDate,
  manilaDate,
  manilaDayStart,
  manilaYear,
} from "./manila-time";

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

describe("manilaDate", () => {
  it("gives the YYYY-MM-DD date in Manila", () => {
    expect(manilaDate(new Date("2026-10-29T04:00:00Z"))).toBe("2026-10-29");
  });

  it("rolls over at Manila midnight, before UTC does", () => {
    // 16:00 UTC on 1 Nov is 00:00 on 2 Nov in Manila.
    expect(manilaDate(new Date("2026-11-01T16:00:00Z"))).toBe("2026-11-02");
    expect(manilaDate(new Date("2026-11-01T15:59:59Z"))).toBe("2026-11-01");
  });

  it("pads the month and day", () => {
    expect(manilaDate(new Date("2027-01-04T00:00:00Z"))).toBe("2027-01-04");
  });
});

describe("manilaDayStart", () => {
  it("is midnight in Manila, 16:00 UTC the day before", () => {
    expect(manilaDayStart("2026-11-09").toISOString()).toBe("2026-11-08T16:00:00.000Z");
  });

  it("rejects anything but a YYYY-MM-DD date", () => {
    expect(() => manilaDayStart("9 Nov 2026")).toThrow(RangeError);
    expect(() => manilaDayStart("2026-11-09T00:00:00Z")).toThrow(RangeError);
    expect(() => manilaDayStart("2026-13-01")).toThrow(RangeError);
  });

  it("rejects a date that isn't on the calendar, instead of rolling it over", () => {
    expect(() => manilaDayStart("2026-02-30")).toThrow(RangeError);
  });
});

describe("isCalendarDate", () => {
  it("accepts a YYYY-MM-DD date on the calendar, leap days included", () => {
    expect(isCalendarDate("2026-11-09")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
  });

  it("rejects a date that isn't on the calendar", () => {
    for (const date of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-11-00"]) {
      expect(isCalendarDate(date), date).toBe(false);
    }
  });

  it("rejects anything but YYYY-MM-DD", () => {
    for (const date of ["9 Nov 2026", "2026-11-09T00:00:00Z", "2026-1-9", ""]) {
      expect(isCalendarDate(date), date).toBe(false);
    }
  });
});
