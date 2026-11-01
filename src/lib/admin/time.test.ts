import { describe, expect, it } from "vitest";

import { formatLoggedAt, greeting, overviewDateLine } from "./time";

// The Overview greeting and the 403 time are Manila time (UTC+8, no daylight
// saving), whatever the server's own time zone is.
const manila = (localTime: string) => new Date(`${localTime}+08:00`);

describe("greeting", () => {
  it.each([
    ["2026-10-22T00:00:00", "Good morning"],
    ["2026-10-22T11:59:59", "Good morning"],
    ["2026-10-22T12:00:00", "Good afternoon"],
    ["2026-10-22T17:59:59", "Good afternoon"],
    ["2026-10-22T18:00:00", "Good evening"],
    ["2026-10-22T23:59:59", "Good evening"],
  ])("at %s in Manila says %s", (localTime, expected) => {
    expect(greeting(manila(localTime), "Angel Rose L. Lepaña")).toBe(`${expected}, Angel.`);
  });

  it("uses Manila time, not UTC: 03:30 UTC is 11:30 in Manila", () => {
    expect(greeting(new Date("2026-10-22T03:30:00Z"), "Angel")).toBe("Good morning, Angel.");
    expect(greeting(new Date("2026-10-22T04:00:00Z"), "Angel")).toBe("Good afternoon, Angel.");
  });

  it("greets by the first word of the name", () => {
    expect(greeting(manila("2026-10-22T09:00:00"), "  Kim   Reyes ")).toBe("Good morning, Kim.");
    expect(greeting(manila("2026-10-22T09:00:00"), "AYC Content Team")).toBe("Good morning, AYC.");
  });
});

describe("overviewDateLine", () => {
  it("gives the weekday and date in capitals", () => {
    expect(overviewDateLine(manila("2026-10-22T09:00:00"))).toBe("THURSDAY · 22 OCT 2026");
  });

  it("moves to the next day at midnight in Manila, not in UTC", () => {
    // 16:30 UTC on Wednesday 21 Oct is 00:30 on Thursday 22 Oct in Manila.
    expect(overviewDateLine(new Date("2026-10-21T16:30:00Z"))).toBe("THURSDAY · 22 OCT 2026");
    expect(overviewDateLine(new Date("2026-10-21T15:59:59Z"))).toBe("WEDNESDAY · 21 OCT 2026");
  });

  it("abbreviates every month to three letters", () => {
    expect(overviewDateLine(manila("2026-09-01T09:00:00"))).toBe("TUESDAY · 1 SEP 2026");
    expect(overviewDateLine(manila("2026-06-15T09:00:00"))).toBe("MONDAY · 15 JUN 2026");
  });
});

describe("formatLoggedAt", () => {
  it.each([
    ["2026-10-22T03:42:00Z", "22 OCT 2026, 11:42 AM"],
    ["2026-10-22T13:05:00Z", "22 OCT 2026, 9:05 PM"],
    ["2026-10-21T16:05:00Z", "22 OCT 2026, 12:05 AM"],
    ["2026-10-22T04:00:00Z", "22 OCT 2026, 12:00 PM"],
  ])("shows %s as %s in Manila", (iso, expected) => {
    expect(formatLoggedAt(iso)).toBe(expected);
  });

  it("throws a RangeError for a non-date", () => {
    expect(() => formatLoggedAt("yesterday")).toThrow(RangeError);
  });
});
