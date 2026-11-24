import { describe, expect, it } from "vitest";

import {
  EXAM_MISSING,
  fieldErrorsOf,
  PLAN_DAYS_ERROR,
  PLAN_NAME_MISSING,
  PLAN_NAME_TOO_LONG,
  type PlanForm,
  planFormSchema,
} from "./admin.schema";
import {
  PLAN_PRICE_MISSING,
  PLAN_PRICE_TOO_HIGH,
  PLAN_PRICE_TOO_LOW,
  PLAN_PRICE_WHOLE,
} from "@/lib/plans/plan-rules";

// A Plan's fields as the Plans & prices editor sends them (Phase 4, ticket
// 01; spec, Phase 4 planning decisions → Plans & prices): a name, an Exam, 30,
// 90, 180 or 365 days, a price in whole pesos from ₱1 to ₱99,999, Best value
// and On sale. The seam's suite (admin.plans.test.ts) covers the rules that
// need the other Plans and the catalogue.

const CE_YEAR: PlanForm = {
  name: "  CE All-Access  ",
  examCode: " ce ",
  days: "365",
  price: "₱3,999",
  bestValue: false,
  onSale: true,
};

const errors = (input: unknown) => {
  const result = planFormSchema.safeParse(input);
  return result.success ? {} : fieldErrorsOf(result.error);
};

describe("planFormSchema", () => {
  it("takes the form's text: the name trimmed, the Exam's code, the days, the price in centavos", () => {
    expect(planFormSchema.parse(CE_YEAR)).toEqual({
      name: "CE All-Access",
      examCode: "CE",
      days: 365,
      priceCentavos: 399_900,
      bestValue: false,
      onSale: true,
    });
  });

  it("takes typed values too", () => {
    expect(planFormSchema.parse({ ...CE_YEAR, days: 90, price: 1299 })).toMatchObject({
      days: 90,
      priceCentavos: 129_900,
    });
  });

  it.each(["1", "99,999", "99999", " 1,299 ", "0499"])("takes a price of %s", (price) => {
    expect(planFormSchema.safeParse({ ...CE_YEAR, price }).success).toBe(true);
  });

  it.each([
    ["0", PLAN_PRICE_TOO_LOW],
    ["₱0", PLAN_PRICE_TOO_LOW],
    ["-499", PLAN_PRICE_TOO_LOW],
    [-499, PLAN_PRICE_TOO_LOW],
    ["499.50", PLAN_PRICE_WHOLE],
    ["499.00", PLAN_PRICE_WHOLE],
    [499.5, PLAN_PRICE_WHOLE],
    ["100,000", PLAN_PRICE_TOO_HIGH],
    [100_000, PLAN_PRICE_TOO_HIGH],
    ["", PLAN_PRICE_MISSING],
    ["   ", PLAN_PRICE_MISSING],
    ["four ninety-nine", PLAN_PRICE_MISSING],
    [Number.NaN, PLAN_PRICE_MISSING],
    [null, PLAN_PRICE_MISSING],
  ])("refuses a price of %j: %s", (price, message) => {
    expect(errors({ ...CE_YEAR, price })).toEqual({ price: [message] });
  });

  it.each([30, 90, 180, 365, "30", " 180 "])("takes %j days", (days) => {
    expect(planFormSchema.safeParse({ ...CE_YEAR, days }).success).toBe(true);
  });

  it.each([0, 1, 60, 91, 364, 366, 90.5, "90 days", "", null])("refuses %j days", (days) => {
    expect(errors({ ...CE_YEAR, days })).toEqual({ days: [PLAN_DAYS_ERROR] });
  });

  it.each(["", "   ", null])("refuses a name of %j", (name) => {
    expect(errors({ ...CE_YEAR, name })).toEqual({ name: [PLAN_NAME_MISSING] });
  });

  it("refuses a name over 80 characters, and takes one of 80", () => {
    expect(errors({ ...CE_YEAR, name: "x".repeat(81) })).toEqual({ name: [PLAN_NAME_TOO_LONG] });
    expect(errors({ ...CE_YEAR, name: "x".repeat(80) })).toEqual({});
  });

  it.each(["", "  ", null])("refuses an Exam of %j", (examCode) => {
    expect(errors({ ...CE_YEAR, examCode })).toEqual({ examCode: [EXAM_MISSING] });
  });

  it("refuses Best value or On sale that isn't true or false", () => {
    expect(Object.keys(errors({ ...CE_YEAR, bestValue: "yes", onSale: 1 })).sort()).toEqual([
      "bestValue",
      "onSale",
    ]);
  });

  it("gives every field's message at once", () => {
    expect(errors({ ...CE_YEAR, name: "", days: 60, price: "0" })).toEqual({
      name: [PLAN_NAME_MISSING],
      days: [PLAN_DAYS_ERROR],
      price: [PLAN_PRICE_TOO_LOW],
    });
  });
});
