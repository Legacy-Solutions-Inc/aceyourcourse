import { describe, expect, it } from "vitest";

import type { PromoBanner } from "@/services/catalogue.types";

import { dayMonth, promoStatus } from "./promo-status";

// The Home promo banner's status line (spec, Phase 2 → Exam pages & promo),
// from the Website's own rule (isPromoActive): whole Asia/Manila days, from
// 00:00 Manila on the start date to 23:59:59 Manila on the end date.

const sale: PromoBanner = {
  visible: true,
  text: "11.11 · Any 2 reviewers, 4% off on Shopee",
  buttonLabel: "Shop the sale",
  href: "https://shopee.ph/aceyourcourse",
  startDate: "2026-11-09",
  endDate: "2026-11-11",
};

const at = (iso: string) => new Date(iso);

describe("promoStatus", () => {
  it.each([
    [
      "23:59 Manila the day before the start",
      "2026-11-08T15:59:00Z",
      "scheduled",
      "SCHEDULED · STARTS 9 NOV",
    ],
    ["00:00 Manila on the start day", "2026-11-08T16:00:00Z", "on", "ON · SHOWS 9–11 NOV"],
    ["23:59 Manila on the end day", "2026-11-11T15:59:00Z", "on", "ON · SHOWS 9–11 NOV"],
    [
      "00:00 Manila the day after the end",
      "2026-11-11T16:00:00Z",
      "ended",
      "ENDED · TURNED OFF BY ITSELF 11 NOV",
    ],
  ])("at %s it's %s", (_when, now, kind, line) => {
    expect(promoStatus(sale, at(now))).toEqual({ kind, line });
  });

  it("is OFF while the banner is turned off, whatever the dates", () => {
    const off = { kind: "off", line: "OFF" };
    expect(promoStatus({ ...sale, visible: false }, at("2026-11-10T04:00:00Z"))).toEqual(off);
    expect(promoStatus({ ...sale, visible: false }, at("2026-12-10T04:00:00Z"))).toEqual(off);
    expect(promoStatus(null, at("2026-11-10T04:00:00Z"))).toEqual(off);
  });

  it("names one day once, and both months when the dates span two", () => {
    const now = at("2026-11-10T04:00:00Z");
    expect(promoStatus({ ...sale, startDate: "2026-11-10", endDate: "2026-11-10" }, now).line).toBe(
      "ON · SHOWS 10 NOV",
    );
    expect(promoStatus({ ...sale, startDate: "2026-10-28", endDate: "2026-11-12" }, now).line).toBe(
      "ON · SHOWS 28 OCT–12 NOV",
    );
    expect(promoStatus({ ...sale, startDate: "2026-10-28", endDate: "2027-01-02" }, now).line).toBe(
      "ON · SHOWS 28 OCT 2026–2 JAN 2027",
    );
  });

  it("is OFF for dates that end before they start, which never ran", () => {
    const backwards = { ...sale, startDate: "2026-11-11", endDate: "2026-11-09" };
    expect(promoStatus(backwards, at("2026-11-20T04:00:00Z"))).toEqual({
      kind: "off",
      line: "OFF",
    });
  });

  it("is OFF for dates that aren't on the calendar", () => {
    expect(promoStatus({ ...sale, startDate: "2026-02-30" }, at("2026-11-10T04:00:00Z"))).toEqual({
      kind: "off",
      line: "OFF",
    });
  });
});

describe("dayMonth", () => {
  it("gives the day and the month, as the confirmation says them", () => {
    expect(dayMonth("2026-11-11")).toBe("11 Nov");
    expect(dayMonth("2027-01-02")).toBe("2 Jan");
  });
});
