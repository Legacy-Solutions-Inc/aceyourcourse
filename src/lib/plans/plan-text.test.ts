import { describe, expect, it } from "vitest";

import { perMonthText, periodLabel } from "./plan-text";

// How a Plan's duration and per-month figure read, in the Admin's Plans &
// prices (ticket 01) and on the Member's Plans page (ticket 02), as the
// mockup words them (BUILD-MAP §3.8).

describe("periodLabel", () => {
  it.each([
    [30, "1 month"],
    [90, "3 months"],
    [180, "6 months"],
    [365, "12 months"],
  ] as const)("calls %i days %s", (days, label) => {
    expect(periodLabel(days)).toBe(label);
  });
});

describe("perMonthText", () => {
  it("divides the price by the months, rounded to whole pesos", () => {
    // ₱1,299 over 3 months is ₱433.
    expect(perMonthText(129_900, 90)).toBe("₱433 / month");
    // ₱2,299 over 6 months is ₱383.17.
    expect(perMonthText(229_900, 180)).toBe("₱383 / month");
    // ₱3,999 over 12 months is ₱333.25.
    expect(perMonthText(399_900, 365)).toBe("₱333 / month");
  });

  it("rounds half a peso up", () => {
    // ₱3 over 6 months is ₱0.50.
    expect(perMonthText(300, 180)).toBe("₱1 / month");
  });

  it("groups thousands", () => {
    expect(perMonthText(9_999_900, 90)).toBe("₱33,333 / month");
  });

  it("says a 30-day Plan is for 30 days, whatever its price", () => {
    expect(perMonthText(49_900, 30)).toBe("for 30 days");
  });

  it("has no figure while there's no price", () => {
    expect(perMonthText(null, 90)).toBe("");
  });
});
