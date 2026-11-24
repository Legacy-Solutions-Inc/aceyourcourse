import "server-only";

import { asc, inArray } from "drizzle-orm";

import { adminWriteLock } from "@/lib/db/admin-locks";
import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { planFromRow, planToRow, staffActivityToRow } from "@/services/admin.rows";
import { type PlanState, type PlanStore, planCalls } from "@/services/plans.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Plans on Postgres (Phase 4, ticket 01): the shared calls
// (src/services/plans.core.ts) over the plans table. Each write runs in one
// transaction that first takes the Plans' write lock, so two writes take
// turns and each one's rules see every Plan the one before it saved; then
// the Plans it changed, the ones it deleted and its Staff Activity are
// written together, or none of them. The table's partial unique indexes keep
// one Best value per Exam and one on sale per Exam and duration even so; the
// Plans losing Best value are written first. Drizzle bypasses RLS, so
// authorisation is the seam's role check and the Staff Guard (coding
// standards §3). Orders arrive in ticket 03, which reads the Plans that have
// one into `withOrders`.
// ─────────────────────────────────────────────────────────────────────────────

const { exams, plans, staffActivity } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Every Plan and the catalogue's Exams, read in `tx`. */
async function readState(tx: Database | Transaction): Promise<PlanState> {
  const planRows = await tx.select().from(plans);
  const examRows = await tx
    .select({ code: exams.code, name: exams.name })
    .from(exams)
    .orderBy(asc(exams.position));
  return { plans: planRows.map(planFromRow), exams: examRows, withOrders: new Set() };
}

const databasePlanStore: PlanStore = {
  async read() {
    try {
      return await readState(getDb());
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
  async withPlans(work) {
    try {
      return await getDb().transaction(async (tx) => {
        await tx.execute(adminWriteLock("plans"));
        const { write, result } = work(await readState(tx));
        if (!write) return result;
        for (const plan of write.saved) {
          const row = planToRow(plan);
          await tx.insert(plans).values(row).onConflictDoUpdate({ target: plans.id, set: row });
        }
        if (write.deleted.length > 0)
          await tx.delete(plans).where(inArray(plans.id, write.deleted));
        await tx.insert(staffActivity).values(write.activity.map(staffActivityToRow));
        return result;
      });
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
};

export const { listPlansForAdmin, createPlan, updatePlan, setPlanOnSale, deletePlan } =
  planCalls(databasePlanStore);
