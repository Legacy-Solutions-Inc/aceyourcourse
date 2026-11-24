import { type PlanStore, planCalls } from "@/services/plans.core";
import { getSampleStore } from "@/services/mock/sample-store";

// The sample arm of the Admin seam's Plans (Phase 4, ticket 01): the shared
// calls (src/services/plans.core.ts) over the in-memory sample store. A Node
// process runs one call at a time here, so a write reads and writes in one
// step. The sample data has no Orders yet (ticket 03), so no Plan has any.

function planState() {
  const store = getSampleStore();
  return structuredClone({
    plans: store.plans,
    exams: store.catalogue.exams.map(({ code, name }) => ({ code, name })),
    withOrders: new Set<string>(),
  });
}

const samplePlanStore: PlanStore = {
  async read() {
    return planState();
  },
  async withPlans(work) {
    const { write, result } = work(planState());
    if (!write) return result;
    const store = getSampleStore();
    // The Staff Activity first: should it fail, nothing else is written.
    store.staffActivity = [...store.staffActivity, ...structuredClone(write.activity)];
    const changed = new Map(write.saved.map((plan) => [plan.id, structuredClone(plan)]));
    const kept = store.plans
      .filter((plan) => !write.deleted.includes(plan.id))
      .map((plan) => changed.get(plan.id) ?? plan);
    const added = [...changed.values()].filter(
      (plan) => !store.plans.some((p) => p.id === plan.id),
    );
    store.plans = [...kept, ...added];
    return result;
  },
};

export const { listPlansForAdmin, createPlan, updatePlan, setPlanOnSale, deletePlan } =
  planCalls(samplePlanStore);
