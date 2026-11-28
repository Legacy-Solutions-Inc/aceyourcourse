import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOT_AN_EXAM } from "@/services/access-passes.core";
import type { Order } from "@/lib/payments/order-ledger";
import { PLAN_PRICE_TOO_LOW } from "@/lib/plans/plan-rules";
import type { PlanForm } from "@/services/admin.schema";
import type { AdminPlan, Plan } from "@/services/admin.types";
import { sampleUserId } from "@/services/mock/members";
import { samplePlanId } from "@/services/mock/plans";
import { onSaleTaken, PLAN_HAS_ORDERS } from "@/services/plans.core";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// Plans & prices (Phase 4, ticket 01; stories 145, 146, 151p, 151q and 151r;
// spec, Phase 4 → Plans and Phase 4 planning decisions → Plans & prices),
// run against every arm. Owners only: an Editor is refused every read and
// write. Each create, edit, switch and delete appends Staff Activity with the
// Plan before and after; an edit runs the conflict check. At most one Plan
// per Exam is Best value (ticking it clears the others, in the same write),
// and at most one per Exam and duration is On sale. Switching a Plan off
// hides it from Members and leaves every Access Pass as it was. A Plan that
// has had an Order can't be deleted (Orders from ticket 03).
//
// The data: the starting Plans, all on sale. CE has 30 days for ₱499, 90 days
// for ₱1,299 (Best value) and 180 days for ₱2,299; ME, EE, MT and CPA each
// have 30 days for ₱449. Bea holds a CE Access Pass.
const BOOT = new Date("2026-11-24T02:00:00.000Z");
const MINUTE = 60_000;

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");
const BEA = sampleUserId("tester@example.com");

const CE_30 = samplePlanId("CE", 30);
const CE_90 = samplePlanId("CE", 90);
const CE_180 = samplePlanId("CE", 180);
const ME_30 = samplePlanId("ME", 30);

/** A 365-day CE Plan, as the editor sends it. */
const CE_YEAR: PlanForm = {
  name: "CE All-Access",
  examCode: "CE",
  days: "365",
  price: "3,999",
  bestValue: false,
  onSale: true,
};

/** A Plan without its stamp: what Staff Activity keeps. */
const bare = ({ stamp: _stamp, ...plan }: AdminPlan): Plan => plan;

/** A Plan's form, as its editor opens it. */
const formOf = (plan: Plan): PlanForm => ({
  name: plan.name,
  examCode: plan.examCode,
  days: String(plan.days),
  price: String(plan.priceCentavos / 100),
  bestValue: plan.bestValue,
  onSale: plan.onSale,
});

describe.each(ADMIN_ARMS)("Admin seam: Plans ($name)", (arm) => {
  const { seam } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));

  async function plans(): Promise<AdminPlan[]> {
    const listed = await seam.listPlansForAdmin(OWNER);
    if (!listed.ok) throw new Error(`The Plans list refused an Owner: ${listed.error.kind}`);
    return listed.value.plans;
  }

  async function plan(id: string): Promise<AdminPlan> {
    const found = (await plans()).find((candidate) => candidate.id === id);
    if (!found) throw new Error(`No Plan ${id}`);
    return found;
  }

  /** Everything a refused call must leave as it was. */
  const snapshot = async () => ({ plans: await plans(), activity: await arm.staffActivity() });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    later(10 * MINUTE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listPlansForAdmin", () => {
    it("gives every starting Plan, on sale, by Exam, then duration, with the Exams in order", async () => {
      const listed = await seam.listPlansForAdmin(OWNER);

      expect(listed).toMatchObject({ ok: true, tags: [] });
      if (!listed.ok) return;
      expect(listed.value.exams.map(({ code }) => code)).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
      expect(listed.value.exams[0]).toEqual({ code: "CE", name: "Civil Engineering" });
      expect(listed.value.plans.map(bare)).toEqual([
        plain("CE", 30, 49_900),
        { ...plain("CE", 90, 129_900), bestValue: true },
        plain("CE", 180, 229_900),
        plain("ME", 30, 44_900),
        plain("EE", 30, 44_900),
        plain("MT", 30, 44_900),
        plain("CPA", 30, 44_900),
      ]);
      expect(listed.value.plans[0]?.stamp).toEqual({
        savedAt: expect.any(String),
        savedBy: null,
      });
    });

    it("refuses an Editor", async () => {
      expect(await seam.listPlansForAdmin(EDITOR)).toEqual({
        ok: false,
        error: { kind: "forbidden", message: expect.any(String) },
      });
    });
  });

  describe("createPlan", () => {
    it("adds a 365-day CE Plan after CE's others, stamped by the Owner, with Staff Activity", async () => {
      const result = await seam.createPlan(OWNER, CE_YEAR);

      expect(result).toMatchObject({ ok: true, tags: [] });
      if (!result.ok) return;
      const added: Plan = {
        id: result.value.id,
        examCode: "CE",
        name: "CE All-Access",
        days: 365,
        priceCentavos: 399_900,
        bestValue: false,
        onSale: true,
      };
      expect(result.value).toEqual({
        ...added,
        stamp: {
          savedAt: new Date(BOOT.getTime() + 10 * MINUTE).toISOString(),
          savedBy: OWNER.name,
        },
      });
      expect((await plans()).map(({ id }) => id).slice(0, 4)).toEqual([
        CE_30,
        CE_90,
        CE_180,
        result.value.id,
      ]);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "plan",
          entityId: result.value.id,
          action: "create",
          before: null,
          after: added,
        }),
      ]);
    });

    it("ticking Best value clears it from CE's other Plan in the same write", async () => {
      const result = await seam.createPlan(OWNER, { ...CE_YEAR, bestValue: true });

      expect(result).toMatchObject({ ok: true, value: { bestValue: true } });
      if (!result.ok) return;
      expect((await plans()).filter((p) => p.bestValue).map(({ id }) => id)).toEqual([
        result.value.id,
      ]);
      const ninety = await plan(CE_90);
      expect(ninety.stamp.savedBy).toBe(OWNER.name);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entityId: CE_90,
          action: "unmark-best-value",
          before: expect.objectContaining({ bestValue: true }),
          after: expect.objectContaining({ bestValue: false }),
        }),
        expect.objectContaining({ entityId: result.value.id, action: "create" }),
      ]);
    });

    it("leaves other Exams' Best value alone", async () => {
      await seam.createPlan(OWNER, { ...CE_YEAR, examCode: "ME", bestValue: true });
      expect((await plan(CE_90)).bestValue).toBe(true);
    });

    it("refuses a second Plan on sale for the same Exam and duration, writing nothing", async () => {
      const before = await snapshot();

      const result = await seam.createPlan(OWNER, { ...CE_YEAR, days: "90" });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: onSaleTaken("CE", 90, "CE All-Access"),
        },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("takes another Plan for the same Exam and duration while it's off sale", async () => {
      const result = await seam.createPlan(OWNER, { ...CE_YEAR, days: "90", onSale: false });
      expect(result).toMatchObject({ ok: true, value: { days: 90, onSale: false } });
    });

    it("refuses an Exam that isn't in the catalogue, writing nothing", async () => {
      const before = await snapshot();

      expect(await seam.createPlan(OWNER, { ...CE_YEAR, examCode: "XYZ" })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { examCode: [NOT_AN_EXAM] } },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses an input the form's rules refuse, writing nothing", async () => {
      const before = await snapshot();

      expect(await seam.createPlan(OWNER, { ...CE_YEAR, price: "0" })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { price: [PLAN_PRICE_TOO_LOW] } },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses an Editor, writing nothing", async () => {
      const before = await snapshot();
      expect(await seam.createPlan(EDITOR, CE_YEAR)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("updatePlan", () => {
    it("saves a new price against the stamp the editor opened with, with Staff Activity", async () => {
      const opened = await plan(CE_30);

      const result = await seam.updatePlan(
        OWNER,
        CE_30,
        { ...formOf(opened), price: "549" },
        { savedAt: opened.stamp.savedAt },
      );

      expect(result).toMatchObject({ ok: true, value: { id: CE_30, priceCentavos: 54_900 } });
      const saved = await plan(CE_30);
      expect(saved.priceCentavos).toBe(54_900);
      expect(saved.stamp).toEqual({
        savedAt: new Date(BOOT.getTime() + 10 * MINUTE).toISOString(),
        savedBy: OWNER.name,
      });
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "plan",
          entityId: CE_30,
          action: "update",
          before: bare(opened),
          after: { ...bare(opened), priceCentavos: 54_900 },
        }),
      ]);
    });

    it("ticking Best value on CE's 30 days clears it from its 90 days", async () => {
      const opened = await plan(CE_30);

      await seam.updatePlan(OWNER, CE_30, { ...formOf(opened), bestValue: true });

      expect((await plans()).filter((p) => p.bestValue).map(({ id }) => id)).toEqual([CE_30]);
    });

    it("refuses a stale edit: someone saved the Plan after the editor opened it", async () => {
      const opened = await plan(CE_180);
      later(20 * MINUTE);
      await seam.updatePlan(OWNER, CE_180, { ...formOf(opened), name: "CE Half-Year" });
      const newer = await plan(CE_180);
      const before = await snapshot();

      const result = await seam.updatePlan(
        OWNER,
        CE_180,
        { ...formOf(opened), price: "1,999" },
        { savedAt: opened.stamp.savedAt },
      );

      expect(result).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: newer.stamp.savedAt },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses moving a Plan on sale onto a duration another has on sale", async () => {
      const opened = await plan(CE_180);
      const before = await snapshot();

      expect(await seam.updatePlan(OWNER, CE_180, { ...formOf(opened), days: "90" })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: onSaleTaken("CE", 90, "CE All-Access"),
        },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses a blank name and an Exam that isn't in the catalogue", async () => {
      const opened = await plan(ME_30);
      expect(await seam.updatePlan(OWNER, ME_30, { ...formOf(opened), name: "  " })).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { name: [expect.any(String)] } },
      });
      expect(
        await seam.updatePlan(OWNER, ME_30, { ...formOf(opened), examCode: "XYZ" }),
      ).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { examCode: [NOT_AN_EXAM] } },
      });
    });

    it("answers not-found for a Plan that isn't there", async () => {
      expect(await seam.updatePlan(OWNER, "no-such-plan", CE_YEAR)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("refuses an Editor, writing nothing", async () => {
      const opened = await plan(CE_30);
      const before = await snapshot();
      expect(await seam.updatePlan(EDITOR, CE_30, formOf(opened))).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("setPlanOnSale", () => {
    it("switching a Plan off keeps it in the list, marked off, and leaves Access Passes alone", async () => {
      const passes = await arm.member.listAccessPasses(BEA);
      const opened = await plan(CE_90);

      const result = await seam.setPlanOnSale(OWNER, CE_90, false);

      expect(result).toMatchObject({ ok: true, value: { id: CE_90, onSale: false } });
      expect(await plan(CE_90)).toMatchObject({ onSale: false, bestValue: true });
      expect(await arm.member.listAccessPasses(BEA)).toEqual(passes);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entityId: CE_90,
          action: "set-on-sale",
          before: bare(opened),
          after: { ...bare(opened), onSale: false },
        }),
      ]);
    });

    it("saves with no conflict check, and an editor opened before it then conflicts", async () => {
      const opened = await plan(CE_90);
      await seam.setPlanOnSale(OWNER, CE_90, false);

      expect(
        await seam.updatePlan(OWNER, CE_90, formOf(opened), { savedAt: opened.stamp.savedAt }),
      ).toMatchObject({ ok: false, error: { kind: "conflict" } });
    });

    it("refuses switching one on while another is on sale for the Exam and duration", async () => {
      const added = await seam.createPlan(OWNER, { ...CE_YEAR, days: "30", onSale: false });
      if (!added.ok) throw new Error("The Plan wasn't added");
      const before = await snapshot();

      expect(await seam.setPlanOnSale(OWNER, added.value.id, true)).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: onSaleTaken("CE", 30, "CE All-Access"),
        },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("changes nothing when the Plan is already as asked", async () => {
      const before = await snapshot();
      expect(await seam.setPlanOnSale(OWNER, CE_30, true)).toMatchObject({ ok: true });
      expect(await snapshot()).toEqual(before);
    });

    it("answers not-found for a Plan that isn't there, and refuses an Editor", async () => {
      expect(await seam.setPlanOnSale(OWNER, "no-such-plan", false)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      const before = await snapshot();
      expect(await seam.setPlanOnSale(EDITOR, CE_30, false)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("deletePlan", () => {
    it("deletes a Plan with no Orders, with Staff Activity", async () => {
      const opened = await plan(CE_180);

      expect(await seam.deletePlan(OWNER, CE_180)).toEqual({
        ok: true,
        value: bare(opened),
        tags: [],
      });
      expect((await plans()).some(({ id }) => id === CE_180)).toBe(false);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entityId: CE_180,
          action: "delete",
          before: bare(opened),
          after: null,
        }),
      ]);
    });

    it("refuses to delete a Plan that has had an Order, changing nothing", async () => {
      await arm.putOrder(orderFor(CE_180));
      const before = await snapshot();

      expect(await seam.deletePlan(OWNER, CE_180)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: PLAN_HAS_ORDERS },
      });
      expect(await snapshot()).toEqual(before);
      // A Plan with no Order still deletes.
      expect(await seam.deletePlan(OWNER, CE_30)).toMatchObject({ ok: true });
    });

    it("answers not-found for a Plan that isn't there, and refuses an Editor", async () => {
      expect(await seam.deletePlan(OWNER, "no-such-plan")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      const before = await snapshot();
      expect(await seam.deletePlan(EDITOR, CE_180)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });
});

/**
 * A fixture Order for a CE Plan, Pending, from a Member whose account has
 * since gone (no User id), as a Member's Pay makes them (ticket 03).
 */
function orderFor(planId: string): Order {
  return {
    id: "3e2d1c0b-9a8f-4e7d-8c6b-5a4f3e2d1c0b",
    reference: "AYC-10001",
    userId: null,
    examCode: "CE",
    planId,
    planName: "CE All-Access",
    days: 180,
    priceCentavos: 229_900,
    method: "card",
    status: "pending",
    livemode: false,
    checkoutId: null,
    paymentId: null,
    buyerName: "Bea Tester",
    buyerEmail: "tester@example.com",
    createdAt: BOOT.toISOString(),
    paidAt: null,
    statusChangedAt: BOOT.toISOString(),
    paidWithoutAccount: false,
  };
}

/** A starting Plan on sale, not Best value. */
function plain(examCode: string, days: 30 | 90 | 180 | 365, priceCentavos: number): Plan {
  return {
    id: samplePlanId(examCode, days),
    examCode,
    name: `${examCode} All-Access`,
    days,
    priceCentavos,
    bestValue: false,
    onSale: true,
  };
}
