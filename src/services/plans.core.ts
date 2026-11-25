import { z } from "zod";

import { periodLabel } from "@/lib/plans/plan-text";
import type { PlanDays } from "@/lib/plans/plan-rules";
import { NOT_AN_EXAM } from "@/services/access-passes.core";
import {
  invalidInput,
  type PlanForm,
  planFormSchema,
  type PlanInput,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminPlan,
  AdminPlans,
  AdminResult,
  Plan,
  RecordStamp,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import { activityRecord, formError, NOT_FOUND, refused } from "@/services/content-editor.core";
import { nextStamp } from "@/services/mock/sample-store";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Plans (Phase 4, ticket 01; stories 145, 146, 151p, 151q and
// 151r; spec, Phase 4 planning decisions → Plans & prices), shared by both
// arms. Owners only, every read and write. The rules:
//
// - A Plan's own fields follow planFormSchema (admin.schema.ts), and its Exam
//   must be in the catalogue.
// - At most one Best value per Exam: a Plan saved as Best value clears it
//   from its Exam's others in the same write, each with its own Staff
//   Activity record ("unmark-best-value") and new stamp.
// - At most one On sale per Exam and duration: a save or a switch that would
//   make a second is refused, and nothing is written.
// - A Plan that has had an Order (ticket 03) can't be deleted; it can be
//   switched off.
//
// An edit runs the conflict check against the stamp its editor opened with.
// The On sale switch always saves, but moves the stamp on, so an editor
// opened before it conflicts instead of switching it back. Switching a Plan
// off hides it from Members; it never touches an Access Pass. A Plan's price
// is copied onto each Order at Pay (orders.core.ts), so a change applies to
// new purchases only.
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN = "ONLY AN OWNER CAN MANAGE PLANS";

export const PLAN_HAS_ORDERS =
  "This Plan has Orders, so it can’t be deleted. Switch it off instead: Members stop seeing it, and everyone who bought it keeps their access.";

/** Pure: why a Plan can't go on sale, naming the Plan already on sale. */
export const onSaleTaken = (examCode: string, days: PlanDays, name: string) =>
  `${examCode} already has a ${periodLabel(days)} Plan on sale: “${name}”. Switch that one off first.`;

/** An Exam a Plan can be for, as the catalogue lists it. */
export type PlanExam = AdminPlans["exams"][number];

/** Every Plan as it is now, each with its last save, and what the rules read alongside them. */
export interface PlanState {
  plans: AdminPlan[];
  /** The catalogue's Exams, in order. */
  exams: PlanExam[];
  /** The ids of the Plans that have had an Order (ticket 03). */
  withOrders: ReadonlySet<string>;
}

/** What a write changes, all or nothing. */
export interface PlanWrite {
  /** Plans added or changed, in the order to write them: the ones losing Best value first. */
  saved: AdminPlan[];
  /** The ids of the Plans deleted. */
  deleted: string[];
  /** One record per Plan changed. */
  activity: StaffActivity[];
}

/** How an arm reads and writes the Plans. */
export interface PlanStore {
  /** Every Plan and the catalogue's Exams, as they are now. */
  read(): Promise<PlanState>;
  /**
   * Runs `work` on the Plans as they are now, then writes what it gives, as
   * one step: two writes never interleave, and a write that fails partway
   * leaves everything as it was. Gives work's result.
   */
  withPlans<T>(work: (state: PlanState) => { write: PlanWrite | null; result: T }): Promise<T>;
}

/** Pure: a Plan without its stamp, as Staff Activity keeps it. */
const planOf = ({ stamp: _stamp, ...plan }: AdminPlan): Plan => plan;

/** Pure: the Plans by Exam (in the catalogue's order), then duration, name and id. */
function inOrder(plans: AdminPlan[], exams: PlanExam[]): AdminPlan[] {
  const place = (code: string) => {
    const index = exams.findIndex((exam) => exam.code === code);
    return index === -1 ? exams.length : index;
  };
  return [...plans].sort(
    (a, b) =>
      place(a.examCode) - place(b.examCode) ||
      a.days - b.days ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}

/** A Plan's id: anything else is no Plan's. */
const planIdSchema = z.string().uuid();

/** The Admin seam's Plans, over an arm's store. */
export function planCalls(store: PlanStore) {
  const saved = <T>(value: T): AdminResult<T> => ({ ok: true, value, tags: [] });
  const refuse = (error: AdminError) => ({ write: null, result: refused(error) });

  /**
   * The rules a Plan saved as `plan` must keep with the others, and the
   * write: the Exam is in the catalogue, it's the only one on sale for its
   * Exam and duration, and as Best value it clears its Exam's others.
   */
  function savePlan(
    actor: StaffActor,
    state: PlanState,
    now: Date,
    before: AdminPlan | null,
    plan: Plan,
    action: string,
  ) {
    if (!state.exams.some((exam) => exam.code === plan.examCode)) {
      return refuse({ kind: "invalid", fieldErrors: { examCode: [NOT_AN_EXAM] } });
    }
    const others = state.plans.filter((other) => other.id !== plan.id);
    const onSale = others.find(
      (other) =>
        plan.onSale && other.onSale && other.examCode === plan.examCode && other.days === plan.days,
    );
    if (onSale) return refuse(formError(onSaleTaken(plan.examCode, plan.days, onSale.name)));

    const stampAfter = (stamp: RecordStamp) => nextStamp(stamp, actor.name, now);
    const unmarked = plan.bestValue
      ? others
          .filter((other) => other.bestValue && other.examCode === plan.examCode)
          .map((other) => ({
            before: other,
            after: { ...other, bestValue: false, stamp: stampAfter(other.stamp) },
          }))
      : [];
    const after: AdminPlan = {
      ...plan,
      stamp: before
        ? stampAfter(before.stamp)
        : { savedAt: now.toISOString(), savedBy: actor.name },
    };
    const record = (entityId: string, name: string, was: AdminPlan | null, is: AdminPlan) =>
      activityRecord(actor, now, "plan", entityId, name, was && planOf(was), planOf(is));
    return {
      write: {
        saved: [...unmarked.map(({ after: cleared }) => cleared), after],
        deleted: [],
        activity: [
          ...unmarked.map((change) =>
            record(change.before.id, "unmark-best-value", change.before, change.after),
          ),
          record(plan.id, action, before, after),
        ],
      },
      result: saved(after),
    };
  }

  /** The role check and the form's rules: the refusal, or the Plan's fields. */
  function checked(
    actor: StaffActor,
    form: PlanForm,
  ): { refusal: AdminResult<never> } | { input: PlanInput } {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return { refusal: refused(role) };
    const parsed = planFormSchema.safeParse(form);
    return parsed.success
      ? { input: parsed.data }
      : { refusal: refused(invalidInput(parsed.error)) };
  }

  async function listPlansForAdmin(actor: StaffActor): Promise<AdminResult<AdminPlans>> {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return refused(role);
    const { plans, exams } = await store.read();
    return saved({ plans: inOrder(plans, exams), exams });
  }

  async function createPlan(actor: StaffActor, form: PlanForm): Promise<AdminResult<AdminPlan>> {
    const checks = checked(actor, form);
    if ("refusal" in checks) return checks.refusal;
    const plan: Plan = { id: crypto.randomUUID(), ...checks.input };
    const now = new Date();
    return store.withPlans((state) => savePlan(actor, state, now, null, plan, "create"));
  }

  async function updatePlan(
    actor: StaffActor,
    id: string,
    form: PlanForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminPlan>> {
    const checks = checked(actor, form);
    if ("refusal" in checks) return checks.refusal;
    if (!planIdSchema.safeParse(id).success) return NOT_FOUND;
    const now = new Date();
    return store.withPlans((state) => {
      const before = state.plans.find((candidate) => candidate.id === id);
      if (!before) return { write: null, result: NOT_FOUND };
      if (expected && expected.savedAt !== before.stamp.savedAt) {
        return refuse({ kind: "conflict", ...before.stamp });
      }
      return savePlan(actor, state, now, before, { id, ...checks.input }, "update");
    });
  }

  async function setPlanOnSale(
    actor: StaffActor,
    id: string,
    onSale: boolean,
  ): Promise<AdminResult<AdminPlan>> {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return refused(role);
    if (!planIdSchema.safeParse(id).success) return NOT_FOUND;
    const now = new Date();
    return store.withPlans((state) => {
      const before = state.plans.find((candidate) => candidate.id === id);
      if (!before) return { write: null, result: NOT_FOUND };
      if (before.onSale === onSale) return { write: null, result: saved(before) };
      return savePlan(actor, state, now, before, { ...planOf(before), onSale }, "set-on-sale");
    });
  }

  async function deletePlan(actor: StaffActor, id: string): Promise<AdminResult<Plan>> {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return refused(role);
    if (!planIdSchema.safeParse(id).success) return NOT_FOUND;
    const now = new Date();
    return store.withPlans((state) => {
      const before = state.plans.find((candidate) => candidate.id === id);
      if (!before) return { write: null, result: NOT_FOUND };
      if (state.withOrders.has(id)) return refuse(formError(PLAN_HAS_ORDERS));
      return {
        write: {
          saved: [],
          deleted: [id],
          activity: [activityRecord(actor, now, "plan", id, "delete", planOf(before), null)],
        },
        result: saved(planOf(before)),
      };
    });
  }

  return { listPlansForAdmin, createPlan, updatePlan, setPlanOnSale, deletePlan };
}
