import { describe, expect, it } from "vitest";

import {
  accessPeriodLabel,
  newPlanFormValues,
  parsePlansParams,
  perMonthText,
  periodLabel,
  planFormValues,
  planPreviewTag,
  plansHref,
  previewPrice,
} from "./plan-view";
import { isPlanDays, PLAN_DAYS, toPlanDays } from "@/lib/plans/plan-rules";

// How the Admin's Plans & prices screen (Phase 4, ticket 01) words a Plan's
// duration and its per-month figure, as the mockup does (BUILD-MAP §3.8).

describe("PLAN_DAYS", () => {
  it("is 30, 90, 180 and 365 days, shortest first", () => {
    expect(PLAN_DAYS).toEqual([30, 90, 180, 365]);
  });

  it.each([30, 90, 180, 365])("knows %i days", (days) => {
    expect(isPlanDays(days)).toBe(true);
  });

  it.each([0, 1, 60, 91, 364, 366, 90.5, Number.NaN, "90"])("refuses %j days", (days) => {
    expect(isPlanDays(days)).toBe(false);
  });

  it("takes a stored duration as a Plan's, and throws for any other", () => {
    expect(toPlanDays(180)).toBe(180);
    expect(() => toPlanDays(60)).toThrow(RangeError);
  });
});

describe("accessPeriodLabel", () => {
  it.each([
    [30, "1 month · 30 days"],
    [90, "3 months · 90 days"],
    [180, "6 months · 180 days"],
    [365, "12 months · 365 days"],
  ] as const)("labels %i days %s", (days, label) => {
    expect(accessPeriodLabel(days)).toBe(label);
  });
});

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

describe("planPreviewTag", () => {
  it("names the Exam and the period, in capitals", () => {
    expect(planPreviewTag("CE", 90)).toBe("CE · 3 MONTHS");
    expect(planPreviewTag("MT", 30)).toBe("MT · 1 MONTH");
  });
});

describe("parsePlansParams", () => {
  it("reads the Exam chip, as a code, and the selected Plan", () => {
    expect(parsePlansParams({ exam: "ce", plan: "abc" })).toEqual({ exam: "CE", plan: "abc" });
    expect(parsePlansParams({ plan: "new" })).toEqual({ exam: null, plan: "new" });
  });

  it("reads nothing from blank or missing values, and the first of repeated ones", () => {
    expect(parsePlansParams({})).toEqual({ exam: null, plan: null });
    expect(parsePlansParams({ exam: " ", plan: "" })).toEqual({ exam: null, plan: null });
    expect(parsePlansParams({ exam: ["me", "ce"] })).toEqual({ exam: "ME", plan: null });
  });

  it("cuts an over-long value", () => {
    expect(parsePlansParams({ plan: "x".repeat(500) }).plan).toHaveLength(100);
  });
});

describe("plansHref", () => {
  it("puts the Exam chip and the selected Plan in the address", () => {
    expect(plansHref({ exam: "CE", plan: "abc" })).toBe("/admin/plans?exam=ce&plan=abc");
    expect(plansHref({ exam: null, plan: "new" })).toBe("/admin/plans?plan=new");
    expect(plansHref({ exam: "MT", plan: null })).toBe("/admin/plans?exam=mt");
    expect(plansHref({ exam: null, plan: null })).toBe("/admin/plans");
  });
});

describe("planFormValues", () => {
  it("gives the editor a Plan's fields as text, the price grouped", () => {
    expect(
      planFormValues({
        id: "p1",
        examCode: "CE",
        name: "CE All-Access",
        days: 90,
        priceCentavos: 129_900,
        bestValue: true,
        onSale: false,
      }),
    ).toEqual({
      name: "CE All-Access",
      examCode: "CE",
      days: "90",
      price: "1,299",
      bestValue: true,
      onSale: false,
    });
  });
});

describe("newPlanFormValues", () => {
  it("opens a new Plan for the Exam named after it: 30 days, no price, off sale", () => {
    expect(newPlanFormValues("ME")).toEqual({
      name: "ME All-Access",
      examCode: "ME",
      days: "30",
      price: "",
      bestValue: false,
      onSale: false,
    });
  });
});

describe("previewPrice", () => {
  it.each([
    ["1,299", 129_900],
    ["₱ 499", 49_900],
    ["99999", 9_999_900],
  ])("reads %s as %i centavos", (text, centavos) => {
    expect(previewPrice(text)).toBe(centavos);
  });

  it.each(["", "0", "499.50", "100,000", "-5", "abc"])("has no price for %j", (text) => {
    expect(previewPrice(text)).toBeNull();
  });
});
