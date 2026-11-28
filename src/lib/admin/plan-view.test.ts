import { describe, expect, it } from "vitest";

import {
  accessPeriodLabel,
  newPlanFormValues,
  parsePlansParams,
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
