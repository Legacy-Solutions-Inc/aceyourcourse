import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Order } from "@/lib/payments/order-ledger";
import type { StaffActor } from "@/services/admin.types";
import { samplePlanId } from "@/services/mock/plans";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// The Admin seam's overview area, run against every arm (spec, Phase 2 story
// 61): the catalogue data the Overview works out what needs Staff from. It's
// read fresh, so a fix made elsewhere shows on the next load.
const BOOT = new Date("2026-10-22T03:42:00.000Z");

const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

describe.each(ADMIN_ARMS)("Admin seam: Overview ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives every Product, Exam and Exam page record, and the Website's settings", async () => {
    const overview = await seam.getOverview(EDITOR);
    expect(overview.products).toHaveLength(15);
    expect(overview.products.filter((p) => p.state === "coming-soon")).toHaveLength(7);
    expect(overview.exams.map((exam) => exam.code)).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
    expect(overview.settings.shopStats.asOf).toBe("2026-10-29");
    expect(overview.settings.promoBanner?.visible).toBe(false);
    expect(Array.isArray(overview.examPages)).toBe(true);
  });

  it("includes Products hidden from the Website", async () => {
    await arm.reset((seed) => {
      const [first] = seed.products;
      if (first) first.showOnWebsite = false;
    });
    const { products } = await seam.getOverview(EDITOR);
    expect(products.filter((product) => !product.showOnWebsite)).toHaveLength(1);
  });

  it("reads a fix made elsewhere on the next load", async () => {
    const before = await seam.getOverview(EDITOR);
    expect(before.settings.promoBanner?.visible).toBe(false);
    const result = await seam.setPromoBannerVisible(EDITOR, true);
    expect(result.ok).toBe(true);
    expect((await seam.getOverview(EDITOR)).settings.promoBanner?.visible).toBe(true);
  });

  it("gives a copy: changing it changes nothing in the catalogue", async () => {
    const overview = await seam.getOverview(EDITOR);
    overview.settings.shopStats.asOf = "2020-01-01";
    overview.products.splice(0);
    const again = await seam.getOverview(EDITOR);
    expect(again.settings.shopStats.asOf).toBe("2026-10-29");
    expect(again.products).toHaveLength(15);
  });
});

// The Owner's sales figures, Member figures and payment work (Phase 4,
// ticket 11; stories 151, 151w and 151x), run against every arm. An Editor's
// Overview has none of it: the seam gives them null, whatever the page shows.
//
// "Now" is 10:00 on 25 Nov 2026 in Manila. The Orders, at Manila times:
//   AYC-10001 Bea, ₱1,299, paid today 09:00; her official invoice requested
//   AYC-10002 Paolo, ₱449, paid yesterday 23:59; ₱100 refunded today 09:30
//   AYC-10003 Bea, ₱499, paid 3 Nov
//   AYC-10004 Bea, ₱749, paid today 09:10: a Test Order
//   AYC-10005 Paolo, ₱449, Pending since today 09:00
//   AYC-10006 Paolo, ₱449, Pending since yesterday 04:00: expired
//   AYC-10007 Bea, ₱229, paid 10 Oct
//   AYC-10008 Paolo, ₱449, made 23 Nov 08:00, paid yesterday 10:00: after expiry
// The Access Passes: Bea's ends in 60 days, Paolo's in 3, Lou's ended an hour
// ago, and the Owner (Staff) holds one ending in 2.
describe.each(ADMIN_ARMS)("Admin seam: the Owner's sales figures ($name)", (arm) => {
  const { seam, member } = arm;
  const NOW = new Date("2026-11-25T02:00:00.000Z");
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const OWNER = sampleActor("owner");
  const STAFF_EDITOR = sampleActor("editor");

  const BEA = {
    userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
    email: "tester@example.com",
    name: "Bea Tester",
  };
  const PAOLO = {
    userId: "2a4c6e80-1b3d-4f5a-9c7e-0d2f4a6b8c1e",
    email: "paolo.reyes@example.com",
    name: "Paolo Reyes",
  };
  const LOU = {
    userId: "5e1d3c7b-9a2f-4e6d-8c1b-3a5f7e9d2c4b",
    email: "lapsed@example.com",
    name: "Lou Lapsed",
  };
  const OWNER_MEMBER = {
    userId: "0c9e8d7f-6a5b-4c3d-9e2f-1a0b9c8d7e6f",
    email: OWNER.email,
    name: OWNER.name,
  };

  /** An ISO instant for a Manila wall time, "2026-11-24 23:59". */
  const manila = (time: string) => new Date(`${time.replace(" ", "T")}:00+08:00`).toISOString();
  const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

  /** A fixture Order: Bea's CE, Paid by GCash at `paidAt` two minutes after it was made, live. */
  function order(
    reference: string,
    pesos: number,
    fields: Partial<Order> & { paidAt?: string | null },
  ): Order {
    const paidAt = fields.paidAt ?? null;
    const createdAt =
      fields.createdAt ?? new Date(new Date(paidAt ?? NOW).getTime() - 2 * 60_000).toISOString();
    return {
      id: `00000000-0000-4000-8000-${reference.slice(4).padStart(12, "0")}`,
      reference,
      userId: BEA.userId,
      examCode: "CE",
      planId: samplePlanId("CE", 30),
      planName: "CE All-Access",
      days: 30,
      priceCentavos: pesos * 100,
      method: "gcash",
      status: paidAt ? "paid" : "pending",
      livemode: true,
      checkoutId: null,
      paymentId: paidAt ? `pay_Sample${reference.slice(4)}` : null,
      buyerName: BEA.name,
      buyerEmail: BEA.email,
      statusChangedAt: paidAt ?? createdAt,
      ...fields,
      createdAt,
      paidAt,
    };
  }

  const PAOLOS = {
    userId: PAOLO.userId,
    buyerName: PAOLO.name,
    buyerEmail: PAOLO.email,
    examCode: "ME",
    planId: samplePlanId("ME", 30),
    planName: "ME All-Access",
  } as const;

  const ORDERS = [
    order("AYC-10001", 1_299, { paidAt: manila("2026-11-25 09:00") }),
    order("AYC-10002", 449, { ...PAOLOS, paidAt: manila("2026-11-24 23:59") }),
    order("AYC-10003", 499, { paidAt: manila("2026-11-03 12:00") }),
    order("AYC-10004", 749, { paidAt: manila("2026-11-25 09:10"), livemode: false }),
    order("AYC-10005", 449, { ...PAOLOS, createdAt: manila("2026-11-25 09:00") }),
    order("AYC-10006", 449, { ...PAOLOS, createdAt: manila("2026-11-24 04:00") }),
    order("AYC-10007", 229, { paidAt: manila("2026-10-10 12:00") }),
    order("AYC-10008", 449, {
      ...PAOLOS,
      createdAt: manila("2026-11-23 08:00"),
      paidAt: manila("2026-11-24 10:00"),
    }),
  ];

  /** Records a PayMongo refund of `pesos` on an Order, made at a Manila wall time. */
  const refund = (reference: string, pesos: number, time: string) =>
    member.recordPaymentEvent({
      id: `evt_Refund${reference.slice(4)}`,
      type: "payment.refund.updated",
      outcome: "refund",
      checkoutId: null,
      orderId: null,
      reference: null,
      paymentId: `pay_Sample${reference.slice(4)}`,
      livemode: true,
      refunds: [
        {
          id: `ref_Sample${reference.slice(4)}`,
          amountCentavos: pesos * 100,
          status: "succeeded",
          refundedAt: manila(time),
        },
      ],
    });

  const money = (paidPesos: number, refundedPesos = 0, netPesos = paidPesos) => ({
    paidCentavos: paidPesos * 100,
    refundedCentavos: refundedPesos * 100,
    netCentavos: netPesos * 100,
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await arm.reset();
    for (const each of [BEA, PAOLO, LOU, OWNER_MEMBER]) await member.getOrCreateMember(each);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function withFixtures() {
    for (const each of ORDERS) await arm.putOrder(each);
    expect(await refund("AYC-10002", 100, "2026-11-25 09:30")).toBe("applied");
    const asked = await member.requestInvoice(BEA.userId, "AYC-10001", {
      name: "Sample Builders Inc.",
      address: "12 Sample St, Jaro, Iloilo City",
      tin: "123456789000",
    });
    expect(asked.ok).toBe(true);
    await arm.putAccessPass({ userId: BEA.userId, examCode: "CE", endsAt: inDays(60) });
    await arm.putAccessPass({ userId: PAOLO.userId, examCode: "ME", endsAt: inDays(3) });
    await arm.putAccessPass({
      userId: LOU.userId,
      examCode: "CE",
      endsAt: new Date(NOW.getTime() - HOUR).toISOString(),
    });
    await arm.putAccessPass({ userId: OWNER_MEMBER.userId, examCode: "CE", endsAt: inDays(2) });
  }

  it("gives an Editor no sales figures and no payment work, and no PAID TODAY card", async () => {
    await withFixtures();

    expect((await seam.getOverview(STAFF_EDITOR)).sales).toBeNull();
    expect(await seam.getPaidToday(STAFF_EDITOR)).toBeNull();
  });

  it("gives an Owner today's, yesterday's and this month's money, matching the Orders", async () => {
    await withFixtures();

    const { sales } = await seam.getOverview(OWNER);

    expect(sales?.figures.today).toEqual({
      date: "2026-11-25",
      orders: 1,
      ...money(1_299, 100, 1_199),
    });
    expect(sales?.figures.yesterday).toEqual({ date: "2026-11-24", ...money(449 + 449) });
    expect(sales?.figures.month).toEqual({
      month: "2026-11",
      ...money(1_299 + 449 + 499 + 449, 100, 2_596),
    });
    expect(sales?.figures.monthBefore).toEqual({
      from: "2026-10-01",
      to: "2026-10-25",
      ...money(229),
    });
    expect(sales?.figures.days).toHaveLength(30);
    expect(sales?.figures.days.slice(-2)).toEqual([
      { date: "2026-11-24", ...money(898) },
      { date: "2026-11-25", ...money(1_299, 100, 1_199) },
    ]);
    expect(sales?.figures.days.find((day) => day.date === "2026-11-03")).toEqual({
      date: "2026-11-03",
      ...money(499),
    });
  });

  it("counts active Members and the passes ending in 7 days, Staff left out", async () => {
    await withFixtures();

    const { sales } = await seam.getOverview(OWNER);

    expect(sales).toMatchObject({ activeMembers: 2, passesEndingSoon: 1 });
  });

  it("gives an Owner the payment work waiting", async () => {
    await withFixtures();

    const { sales } = await seam.getOverview(OWNER);

    expect(sales?.payments).toEqual({
      pending: 1,
      oldestPendingAt: manila("2026-11-25 09:00"),
      invoicesToSend: 1,
      paidAfterExpiry: 1,
      paidAccountDeleted: 0,
    });
  });

  it("gives the PAID TODAY card: today's money, the Orders paid today and the Pending", async () => {
    await withFixtures();

    expect(await seam.getPaidToday(OWNER)).toEqual({
      date: "2026-11-25",
      netCentavos: 119_900,
      orders: 1,
      pending: 1,
    });
  });

  it("gives ₱0 and no payment work with no Orders at all", async () => {
    const { sales } = await seam.getOverview(OWNER);

    expect(sales?.figures.today).toEqual({ date: "2026-11-25", orders: 0, ...money(0) });
    expect(sales?.figures.month).toEqual({ month: "2026-11", ...money(0) });
    expect(sales?.figures.days.every((day) => day.netCentavos === 0)).toBe(true);
    expect(sales).toMatchObject({ activeMembers: 0, passesEndingSoon: 0 });
    expect(sales?.payments).toEqual({
      pending: 0,
      oldestPendingAt: null,
      invoicesToSend: 0,
      paidAfterExpiry: 0,
      paidAccountDeleted: 0,
    });
    expect(await seam.getPaidToday(OWNER)).toEqual({
      date: "2026-11-25",
      netCentavos: 0,
      orders: 0,
      pending: 0,
    });
  });
});
