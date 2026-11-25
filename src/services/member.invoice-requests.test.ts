import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INVOICE_ADDRESS_REQUIRED,
  INVOICE_NAME_REQUIRED,
  INVOICE_TIN_SHAPE,
} from "@/services/member.schema";
import { samplePlanId } from "@/services/mock/plans";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";

import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// The Member seam's Invoice Requests (Phase 4, ticket 08; spec, Phase 4
// planning decisions → Payment Acknowledgement and Invoice Requests; stories
// 144, 151j), run against every arm. A Member asks for the official invoice
// of one of their own Paid Orders, once, with the name, address and TIN to
// put on it; Billing then reads it requested. Anyone else's Order, or one
// that isn't Paid, is refused; so is a second request for the same Order.
//
// "Now" starts at 17 Nov 2026, 11:42 in Manila.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const HOUR = 60 * 60 * 1000;
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
const DETAILS = { name: "Sample Builders Inc.", address: "Jaro, Iloilo City", tin: "123456789000" };

describe.each(MEMBER_ARMS)("Member seam: Invoice Requests ($name)", (arm) => {
  const { seam } = arm;
  let fake: FakePaymentsClient;

  /** Pays for a CE Plan; gives the reference. */
  async function pay(userId = BEA.userId) {
    const result = await seam.payForPlan(
      userId,
      { examCode: "CE", planId: samplePlanId("CE", 90), method: "gcash" },
      fake,
    );
    if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
    return result.reference;
  }
  /** Pays and has the payment go through (or fail). */
  async function settled(outcome: "paid" | "failed", userId = BEA.userId) {
    const reference = await pay(userId);
    const order = await seam.getMemberOrder(userId, reference);
    fake.simulate(order!.id, outcome);
    await seam.checkOrderStatus(userId, reference, fake);
    return reference;
  }
  const invoiceOf = async (userId: string, reference: string) =>
    (await seam.listMemberOrders(userId)).find((order) => order.reference === reference)?.invoice ??
    null;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    for (const member of [BEA, SAM]) {
      await seam.getOrCreateMember(member);
      await seam.addTargetExam(member.userId, { examCode: "CE", examDate: CE_OFFICIAL });
    }
    fake = createFakePaymentsClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads no invoice on an Order before one is requested", async () => {
    const reference = await settled("paid");

    expect(await invoiceOf(BEA.userId, reference)).toBeNull();
    expect(await seam.getPaymentAcknowledgement(BEA.userId, reference)).toMatchObject({
      order: { invoice: null },
    });
  });

  it("records a request for the Member's own Paid Order, which Billing and the Acknowledgement then read as requested", async () => {
    const reference = await settled("paid");
    vi.setSystemTime(new Date(BOOT.getTime() + HOUR));

    expect(await seam.requestInvoice(BEA.userId, reference, DETAILS)).toEqual({ ok: true });

    const requested = {
      status: "requested",
      requestedAt: new Date(BOOT.getTime() + HOUR).toISOString(),
      sentAt: null,
    };
    expect(await invoiceOf(BEA.userId, reference)).toEqual(requested);
    expect(await seam.getMemberOrder(BEA.userId, reference)).toMatchObject({ invoice: requested });
    expect(await seam.getPaymentAcknowledgement(BEA.userId, reference)).toMatchObject({
      order: { invoice: requested },
    });
  });

  it("refuses a second request for the same Order, keeping the first", async () => {
    const reference = await settled("paid");
    await seam.requestInvoice(BEA.userId, reference, DETAILS);
    vi.setSystemTime(new Date(BOOT.getTime() + HOUR));

    expect(
      await seam.requestInvoice(BEA.userId, reference, { ...DETAILS, name: "Bea Tester" }),
    ).toEqual({ ok: false, reason: "already-requested" });
    expect(await invoiceOf(BEA.userId, reference)).toMatchObject({
      requestedAt: BOOT.toISOString(),
    });
  });

  it("keeps one request when two arrive together", async () => {
    const reference = await settled("paid");

    const results = await Promise.all([
      seam.requestInvoice(BEA.userId, reference, DETAILS),
      seam.requestInvoice(BEA.userId, reference, DETAILS),
    ]);

    expect(results).toEqual(
      expect.arrayContaining([{ ok: true }, { ok: false, reason: "already-requested" }]),
    );
  });

  it.each([
    ["Pending", async () => pay()],
    ["Failed", async () => settled("failed")],
  ] as const)("refuses a request for a %s Order", async (_what, made) => {
    const reference = await made();

    expect(await seam.requestInvoice(BEA.userId, reference, DETAILS)).toEqual({
      ok: false,
      reason: "not-paid",
    });
    expect(await invoiceOf(BEA.userId, reference)).toBeNull();
  });

  it("refuses a request for an Order that's Expired", async () => {
    const reference = await pay();
    vi.setSystemTime(new Date(BOOT.getTime() + 25 * HOUR));

    expect(await seam.requestInvoice(BEA.userId, reference, DETAILS)).toEqual({
      ok: false,
      reason: "not-paid",
    });
  });

  it("refuses a request for another Member's Order, as if it weren't there", async () => {
    const reference = await settled("paid", SAM.userId);

    expect(await seam.requestInvoice(BEA.userId, reference, DETAILS)).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await invoiceOf(SAM.userId, reference)).toBeNull();
  });

  it.each(["AYC-99999", "nonsense"])("refuses a request for %j", async (reference) => {
    await settled("paid");
    expect(await seam.requestInvoice(BEA.userId, reference, DETAILS)).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("refuses an empty name or address, and a TIN in the wrong shape, with a message for each field", async () => {
    const reference = await settled("paid");

    expect(
      await seam.requestInvoice(BEA.userId, reference, { name: " ", address: "", tin: "12345" }),
    ).toEqual({
      ok: false,
      reason: "invalid",
      fields: {
        name: INVOICE_NAME_REQUIRED,
        address: INVOICE_ADDRESS_REQUIRED,
        tin: INVOICE_TIN_SHAPE,
      },
    });
    expect(await invoiceOf(BEA.userId, reference)).toBeNull();
  });
});
