import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeText } from "@/lib/member-app/notices";
import { PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import { samplePlanId } from "@/services/mock/plans";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// The Member seam's buying (Phase 4, ticket 03; spec, Phase 4 → Order ledger,
// Return flow, References; Phase 4 planning decisions → Paying, Who buys;
// Testing Decisions → Phase 4 seams → Member seam, extended; stories
// 135–140), run against every arm with the payments fake. Pay makes a Pending
// Order with the Plan's name, days and price copied from the database, and
// sends the Member to the checkout. A Paid outcome, as the payments client
// reports it, adds the Order's days to the Member's Access Pass, keeps them
// as a paid history row, adds the Exam to their Target Exams, leaves a notice
// and logs it in Staff Activity under "PayMongo (system)", all or nothing,
// once. A Member only ever reads their own Orders.
//
// The data: the starting Plans on sale (CE 30/90/180 days at ₱499/₱1,299/
// ₱2,299; every other Exam 30 days at ₱449); CE has an Official Exam Date (21
// Nov 2026); CHE has a Plan on sale but isn't on the Website. "Now" is 17 Nov
// 2026, 11:42 in Manila.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const OWNER = sampleActor("owner");

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: "stranger@example.com",
  name: "Sam Stranger",
};

const CE_90 = samplePlanId("CE", 90);
const ME_30 = samplePlanId("ME", 30);
const inDays = (days: number) => new Date(BOOT.getTime() + days * DAY).toISOString();

describe.each(MEMBER_ARMS)("Member seam: buying ($name)", (arm) => {
  const { seam, admin } = arm;
  let fake: FakePaymentsClient;

  const pay = (userId: string, input: { examCode: string; planId: string; method: string }) =>
    seam.payForPlan(userId, input, fake);
  const payCe90 = (userId = BEA.userId) =>
    pay(userId, { examCode: "CE", planId: CE_90, method: "gcash" });
  /** Pays, then has the fake report `outcome` and asks for the Order's status. */
  async function bought(
    outcome: "paid" | "failed",
    input = { examCode: "CE", planId: CE_90, method: "gcash" },
  ) {
    const result = await pay(BEA.userId, input);
    if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
    const order = await seam.getMemberOrder(BEA.userId, result.reference);
    fake.simulate(order!.id, outcome);
    return seam.checkOrderStatus(BEA.userId, result.reference, fake);
  }
  const passEnd = async (userId: string, examCode: string) =>
    (await seam.listAccessPasses(userId)).find((pass) => pass.examCode === examCode)?.endsAt ??
    null;
  const history = async (userId: string) => {
    const detail = await admin.getMemberForAdmin(OWNER, userId);
    return detail.ok ? detail.value.accessPasses.flatMap((pass) => pass.grants) : [];
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    await seam.getOrCreateMember(BEA);
    await seam.getOrCreateMember(SAM);
    await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_OFFICIAL });
    fake = createFakePaymentsClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("payForPlan", () => {
    it("makes a Pending Order for the Member, AYC-10001 first, and sends them to the checkout", async () => {
      expect(await payCe90()).toEqual({
        ok: true,
        reference: "AYC-10001",
        redirectTo: "/app/plans/orders/AYC-10001",
      });

      expect(await arm.orders()).toEqual([
        {
          id: expect.any(String),
          reference: "AYC-10001",
          userId: BEA.userId,
          examCode: "CE",
          planId: CE_90,
          planName: "CE All-Access",
          days: 90,
          priceCentavos: 129_900,
          method: "gcash",
          status: "pending",
          livemode: false,
          checkoutId: null,
          paymentId: null,
          buyerName: "Bea Tester",
          buyerEmail: "tester@example.com",
          createdAt: BOOT.toISOString(),
          paidAt: null,
          statusChangedAt: BOOT.toISOString(),
        },
      ]);
    });

    it("starts the checkout for that Order alone, with its method, price and way back", async () => {
      await payCe90();

      expect(fake.started).toEqual([
        {
          orderId: (await arm.orders())[0]?.id,
          reference: "AYC-10001",
          description: "CE All-Access · 3 months",
          priceCentavos: 129_900,
          method: "gcash",
          buyer: { name: "Bea Tester", email: "tester@example.com" },
          successPath: "/app/plans/orders/AYC-10001",
          cancelPath: "/app/plans?exam=CE",
        },
      ]);
    });

    it("makes a new Pending Order every click", async () => {
      await payCe90();
      await payCe90();

      expect((await arm.orders()).map(({ reference, status }) => [reference, status])).toEqual([
        ["AYC-10001", "pending"],
        ["AYC-10002", "pending"],
      ]);
    });

    it("keeps the price shown at Pay after an Owner changes the Plan's price", async () => {
      await payCe90();
      const changed = await admin.updatePlan(OWNER, CE_90, {
        name: "CE All-Access",
        examCode: "CE",
        days: "90",
        price: "1599",
        bestValue: true,
        onSale: true,
      });
      expect(changed.ok).toBe(true);

      const [order] = await arm.orders();
      expect(order).toMatchObject({ priceCentavos: 129_900, planName: "CE All-Access", days: 90 });
      expect(await seam.getMemberOrder(BEA.userId, "AYC-10001")).toMatchObject({
        priceCentavos: 129_900,
      });
    });

    it("numbers two Pays at once one after the other, never the same", async () => {
      const results = await Promise.all([payCe90(BEA.userId), payCe90(SAM.userId)]);

      const references = results.map((result) => (result.ok ? result.reference : null)).sort();
      expect(references).toEqual(["AYC-10001", "AYC-10002"]);
      expect((await arm.orders()).map((order) => order.reference).sort()).toEqual(references);
    });

    it("refuses a Plan an Owner switched off, making no Order", async () => {
      await admin.setPlanOnSale(OWNER, CE_90, false);

      expect(await payCe90()).toEqual({ ok: false, reason: "not-on-sale" });
      expect(await arm.orders()).toEqual([]);
    });

    it("refuses a Plan of another Exam than the one posted", async () => {
      expect(await pay(BEA.userId, { examCode: "ME", planId: CE_90, method: "gcash" })).toEqual({
        ok: false,
        reason: "wrong-exam",
      });
      expect(await arm.orders()).toEqual([]);
    });

    it.each([
      ["a Plan id that isn't one", "not-a-plan"],
      ["an id no Plan has", "6f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f"],
      ["the Plan of an Exam that isn't on the Website", samplePlanId("CHE", 30)],
    ])("refuses %s", async (_what, planId) => {
      expect(await pay(BEA.userId, { examCode: "CHE", planId, method: "gcash" })).toEqual({
        ok: false,
        reason: "not-on-sale",
      });
      expect(await arm.orders()).toEqual([]);
    });

    it.each(["paypal", "Card", ""])("refuses the Payment Method %j", async (method) => {
      expect(await pay(BEA.userId, { examCode: "CE", planId: CE_90, method })).toEqual({
        ok: false,
        reason: "bad-method",
      });
      expect(await arm.orders()).toEqual([]);
    });

    it("refuses with no payments client, making no Order", async () => {
      const result = await seam.payForPlan(
        BEA.userId,
        { examCode: "CE", planId: CE_90, method: "gcash" },
        null,
      );

      expect(result).toEqual({ ok: false, reason: "unavailable" });
      expect(await arm.orders()).toEqual([]);
    });

    it("throws for a User id that isn't one", async () => {
      await expect(
        seam.payForPlan("not-a-user-id", { examCode: "CE", planId: CE_90, method: "card" }, fake),
      ).rejects.toThrow();
    });
  });

  describe("getMemberOrder", () => {
    it("gives the Member their own Order", async () => {
      await payCe90();

      expect(await seam.getMemberOrder(BEA.userId, "AYC-10001")).toEqual({
        id: expect.any(String),
        reference: "AYC-10001",
        examCode: "CE",
        planName: "CE All-Access",
        days: 90,
        priceCentavos: 129_900,
        method: "gcash",
        status: "pending",
        createdAt: BOOT.toISOString(),
        paidAt: null,
        accessUntil: null,
      });
    });

    it("never gives another Member's Order", async () => {
      await payCe90(SAM.userId);

      expect(await seam.getMemberOrder(BEA.userId, "AYC-10001")).toBeNull();
      expect(await seam.getMemberOrder(SAM.userId, "AYC-10001")).not.toBeNull();
    });

    it.each(["AYC-99999", "nonsense"])("gives nothing for %j", async (reference) => {
      await payCe90();
      expect(await seam.getMemberOrder(BEA.userId, reference)).toBeNull();
    });
  });

  describe("checkOrderStatus: Paid", () => {
    it("adds the Order's days to the pass: 20 days left + 90 = 110", async () => {
      await arm.putAccessPass({ userId: BEA.userId, examCode: "CE", endsAt: inDays(20) });

      const order = await bought("paid");

      expect(await passEnd(BEA.userId, "CE")).toBe(inDays(110));
      expect(order).toMatchObject({
        reference: "AYC-10001",
        status: "paid",
        paidAt: BOOT.toISOString(),
        accessUntil: inDays(110),
      });
    });

    it("counts 30 days bought from now once the pass has ended", async () => {
      await arm.putAccessPass({ userId: BEA.userId, examCode: "ME", endsAt: inDays(-4) });

      await bought("paid", { examCode: "ME", planId: ME_30, method: "maya" });

      expect(await passEnd(BEA.userId, "ME")).toBe(inDays(30));
    });

    it("keeps the Order's days as a paid history row, under PayMongo (system)", async () => {
      await bought("paid");

      const [order] = await arm.orders();
      expect(await history(BEA.userId)).toEqual([
        {
          days: 90,
          startsAt: BOOT.toISOString(),
          endsAt: inDays(90),
          reason: "Order AYC-10001",
          grantedBy: { ...PAYMONGO_SYSTEM_ACTOR },
          grantedAt: BOOT.toISOString(),
          orderId: order?.id,
        },
      ]);
    });

    it("leaves the Member a notice of their new access", async () => {
      await bought("paid");

      expect((await seam.listNotices(BEA.userId)).map(noticeText)).toEqual([
        "You now have CE All-Access until 15 Feb 2027",
      ]);
    });

    it("logs it in Staff Activity under PayMongo (system), with the ends before and after", async () => {
      await arm.putAccessPass({ userId: BEA.userId, examCode: "CE", endsAt: inDays(20) });
      await bought("paid");

      expect(await arm.adminArm.staffActivity()).toEqual([
        expect.objectContaining({
          actor: { ...PAYMONGO_SYSTEM_ACTOR },
          entity: "access-pass",
          entityId: `${BEA.userId}/CE`,
          action: "order-paid",
          before: { email: BEA.email, examCode: "CE", endsAt: inDays(20) },
          after: {
            email: BEA.email,
            examCode: "CE",
            endsAt: inDays(110),
            days: 90,
            reference: "AYC-10001",
            targetExam: null,
          },
        }),
      ]);
    });

    it("adds an Exam the Member hadn't added to their Target Exams, following its Official Exam Date", async () => {
      await arm.reset(withExamDates);
      await seam.getOrCreateMember(BEA);
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: inDays(60).slice(0, 10) });

      await bought("paid");

      const added = (await seam.listTargetExams(BEA.userId)).find((exam) => exam.examCode === "CE");
      expect(added).toMatchObject({ examCode: "CE", examDate: CE_OFFICIAL });
      expect(await arm.adminArm.staffActivity()).toEqual([
        expect.objectContaining({ after: expect.objectContaining({ targetExam: "added" }) }),
      ]);
      expect((await seam.listNotices(BEA.userId)).map(noticeText)).toEqual([
        "You now have CE All-Access until 15 Feb 2027",
      ]);
    });

    it("extends the pass once when Paid is applied twice", async () => {
      await bought("paid");
      await seam.checkOrderStatus(BEA.userId, "AYC-10001", fake);

      expect(await passEnd(BEA.userId, "CE")).toBe(inDays(90));
      expect(await history(BEA.userId)).toHaveLength(1);
      expect(await seam.listNotices(BEA.userId)).toHaveLength(1);
      expect(await arm.adminArm.staffActivity()).toHaveLength(1);
    });

    it("writes nothing when its Staff Activity can't be written", async () => {
      await arm.putAccessPass({ userId: BEA.userId, examCode: "CE", endsAt: inDays(20) });
      const result = await payCe90();
      const order = result.ok ? await seam.getMemberOrder(BEA.userId, result.reference) : null;
      fake.simulate(order!.id, "paid");
      const mend = await arm.adminArm.breakStaffActivity();
      try {
        await expect(seam.checkOrderStatus(BEA.userId, "AYC-10001", fake)).rejects.toThrow();
      } finally {
        await mend();
      }

      expect((await arm.orders())[0]?.status).toBe("pending");
      expect(await passEnd(BEA.userId, "CE")).toBe(inDays(20));
      expect(await history(BEA.userId)).toEqual([]);
      expect(await seam.listNotices(BEA.userId)).toEqual([]);
    });
  });

  describe("checkOrderStatus: Failed and pending", () => {
    it("marks a Failed Order Failed and grants nothing", async () => {
      await arm.putAccessPass({ userId: BEA.userId, examCode: "CE", endsAt: inDays(20) });

      const order = await bought("failed");

      expect(order).toMatchObject({ status: "failed", paidAt: null, accessUntil: null });
      expect(await passEnd(BEA.userId, "CE")).toBe(inDays(20));
      expect(await history(BEA.userId)).toEqual([]);
      expect(await seam.listNotices(BEA.userId)).toEqual([]);
      expect(await arm.adminArm.staffActivity()).toEqual([]);
    });

    it("leaves an Order pending while the checkout is", async () => {
      await payCe90();

      expect(await seam.checkOrderStatus(BEA.userId, "AYC-10001", fake)).toMatchObject({
        status: "pending",
      });
      expect(await seam.listAccessPasses(BEA.userId)).toEqual([]);
    });

    it("changes nothing with no payments client", async () => {
      const result = await payCe90();
      const order = result.ok ? await seam.getMemberOrder(BEA.userId, result.reference) : null;
      fake.simulate(order!.id, "paid");

      expect(await seam.checkOrderStatus(BEA.userId, "AYC-10001", null)).toMatchObject({
        status: "pending",
      });
      expect(await seam.listAccessPasses(BEA.userId)).toEqual([]);
    });

    it("never reads or settles another Member's Order", async () => {
      await payCe90(SAM.userId);
      const [order] = await arm.orders();
      fake.simulate(order!.id, "paid");

      expect(await seam.checkOrderStatus(BEA.userId, "AYC-10001", fake)).toBeNull();
      expect((await arm.orders())[0]?.status).toBe("pending");
      expect(await seam.listAccessPasses(SAM.userId)).toEqual([]);
    });
  });
});
