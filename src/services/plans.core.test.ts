import { describe, expect, it } from "vitest";

import type { AdminPlan } from "@/services/admin.types";

import { sampleActor } from "../../test/admin-inputs";
import { PLAN_HAS_ORDERS, type PlanState, type PlanWrite, planCalls } from "./plans.core";

// A Plan that has had an Order can't be deleted; it can only be switched off
// (story 151r; spec, Phase 4 planning decisions → Plans & prices), checked
// here over a store whose Plan has an Order. The arms' suite
// (admin.plans.test.ts) checks it with a fixture Order, and covers the rest.

const OWNER = sampleActor("owner");

const CE_90: AdminPlan = {
  id: "0b8f2c4e-1d3a-4f5b-9c6d-7e8f9a0b1c2d",
  examCode: "CE",
  name: "CE All-Access",
  days: 90,
  priceCentavos: 129_900,
  bestValue: true,
  onSale: true,
  stamp: { savedAt: "2026-11-24T02:00:00.000Z", savedBy: null },
};

/** A store holding CE's 90 days, with an Order or not, that keeps what it's asked to write. */
function storeWith(withOrders: string[]) {
  const writes: PlanWrite[] = [];
  const state = (): PlanState => ({
    plans: [structuredClone(CE_90)],
    exams: [{ code: "CE", name: "Civil Engineering" }],
    withOrders: new Set(withOrders),
  });
  const calls = planCalls({
    read: async () => state(),
    withPlans: async (work) => {
      const { write, result } = work(state());
      if (write) writes.push(write);
      return result;
    },
  });
  return { calls, writes };
}

describe("deletePlan", () => {
  it("refuses a Plan that has had an Order, writing nothing", async () => {
    const { calls, writes } = storeWith([CE_90.id]);

    expect(await calls.deletePlan(OWNER, CE_90.id)).toEqual({
      ok: false,
      error: { kind: "invalid", fieldErrors: {}, formError: PLAN_HAS_ORDERS },
    });
    expect(writes).toEqual([]);
  });

  it("still switches that Plan off", async () => {
    const { calls, writes } = storeWith([CE_90.id]);

    expect(await calls.setPlanOnSale(OWNER, CE_90.id, false)).toMatchObject({
      ok: true,
      value: { onSale: false },
    });
    expect(writes).toHaveLength(1);
  });

  it("deletes a Plan with no Order", async () => {
    const { calls, writes } = storeWith([]);

    expect(await calls.deletePlan(OWNER, CE_90.id)).toMatchObject({ ok: true });
    expect(writes).toEqual([
      { saved: [], deleted: [CE_90.id], activity: [expect.objectContaining({ action: "delete" })] },
    ]);
  });
});
