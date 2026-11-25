// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addTargetExam,
  getOrCreateMember,
  listAccessPasses,
  payForPlan,
} from "@/services/member.mock";
import { samplePlanId } from "@/services/mock/plans";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { signFakeWebhook } from "@/services/payments.fake";
import { samplePaymentsFake } from "@/services/payments";

import checkoutPaid from "../../../../../test/fixtures/paymongo/event-checkout-paid.json";
import paymentFailed from "../../../../../test/fixtures/paymongo/event-payment-failed.json";
import paymentRefunded from "../../../../../test/fixtures/paymongo/event-payment-refunded.json";
import refundUpdated from "../../../../../test/fixtures/paymongo/event-refund-updated.json";

// POST /api/paymongo/webhook (Phase 4, ticket 05; Testing Decisions → Phase
// 4 seams → the webhook route): PayMongo's events, on the sample data with
// the payments fake, whose webhooks are signed as PayMongo signs them with a
// test-only secret. A request is trusted only once its signature checks out;
// each event is applied once; Failed and Expired Orders can still become
// Paid, and Paid never moves back. Refund events (ticket 09) take a fully
// refunded Order's unused days off, once. Without PAYMONGO_WEBHOOK_SECRET
// the route doesn't exist.

const { secret } = vi.hoisted(() => ({ secret: { current: undefined as string | undefined } }));
vi.mock("@/env.server", async (original) => {
  const actual = await original<typeof import("@/env.server")>();
  return {
    ...actual,
    get serverEnv() {
      return { ...actual.serverEnv, PAYMONGO_WEBHOOK_SECRET: secret.current };
    },
  };
});

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};

/** A fixture event about an Order: its checkout's metadata names our Order, under a new event id. */
function aboutOrder(
  fixture: typeof checkoutPaid | typeof paymentFailed,
  order: { id: string; reference: string },
  eventId = fixture.data.id,
) {
  const event = structuredClone(fixture) as typeof checkoutPaid;
  event.data.id = eventId;
  const resource = event.data.attributes.data as { attributes: Record<string, unknown> };
  resource.attributes.metadata = { order_id: order.id, reference: order.reference };
  if ("reference_number" in resource.attributes)
    resource.attributes.reference_number = order.reference;
  for (const payment of (resource.attributes.payments ?? []) as {
    attributes: Record<string, unknown>;
  }[]) {
    payment.attributes.metadata = { order_id: order.id, reference: order.reference };
  }
  return JSON.stringify(event);
}

async function post(body: string, signature: string | null = signFakeWebhook(body)) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature === null ? {} : { "paymongo-signature": signature }),
      },
      body,
    }),
  );
}

/** Bea pays for CE 3 months with the fake; gives the Pending Order. */
async function pendingOrder() {
  const result = await payForPlan(
    BEA.userId,
    { examCode: "CE", planId: samplePlanId("CE", 90), method: "gcash" },
    samplePaymentsFake(),
  );
  if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
  const order = getSampleStore().orders.at(-1);
  if (!order) throw new Error("Pay made no Order.");
  return order;
}

const stored = () =>
  getSampleStore().orders.map(({ reference, status }) => ({ reference, status }));
const passEnd = async () =>
  (await listAccessPasses(BEA.userId)).find((pass) => pass.examCode === "CE")?.endsAt ?? null;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  secret.current = "whsk_configured_on_this_server";
  resetSampleStore();
  await getOrCreateMember(BEA);
  await addTargetExam(BEA.userId, { examCode: "CE", examDate: "2027-01-10" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/paymongo/webhook", () => {
  it("makes a Pending Order Paid on a paid checkout, extending the Access Pass, logged as PayMongo", async () => {
    const order = await pendingOrder();

    const response = await post(aboutOrder(checkoutPaid, order));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "paid" }]);
    expect(await passEnd()).toBe(new Date(BOOT.getTime() + 90 * DAY).toISOString());
    expect(getSampleStore().staffActivity.at(-1)).toMatchObject({
      actor: { email: "system:paymongo", name: "PayMongo (system)" },
      action: "order-paid",
    });
  });

  it("answers 404 when the server has no PAYMONGO_WEBHOOK_SECRET", async () => {
    secret.current = undefined;
    const order = await pendingOrder();

    expect((await post(aboutOrder(checkoutPaid, order))).status).toBe(404);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "pending" }]);
  });

  it.each([
    ["a missing signature", null],
    ["a signature that isn't PayMongo's", "t=1,te=abc,li="],
  ])("rejects %s with 401, changing nothing", async (_what, signature) => {
    const order = await pendingOrder();

    expect((await post(aboutOrder(checkoutPaid, order), signature)).status).toBe(401);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "pending" }]);
    expect(getSampleStore().paymentEvents).toEqual([]);
  });

  it("rejects a body changed after signing with 401, changing nothing", async () => {
    const order = await pendingOrder();
    const body = aboutOrder(checkoutPaid, order);

    const response = await post(
      body.replace('"livemode":false', '"livemode":false '),
      signFakeWebhook(body),
    );

    expect(response.status).toBe(401);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "pending" }]);
  });

  it.each([
    ["JSON that isn't an event", JSON.stringify({ hello: "there" })],
    ["a body that isn't JSON", "{not json"],
  ])("rejects %s, signed, with 400", async (_what, body) => {
    expect((await post(body)).status).toBe(400);
    expect(getSampleStore().paymentEvents).toEqual([]);
  });

  it("applies the same event once, however often PayMongo sends it", async () => {
    const order = await pendingOrder();
    const body = aboutOrder(checkoutPaid, order);
    await post(body);
    const end = await passEnd();

    vi.setSystemTime(new Date(BOOT.getTime() + HOUR));
    const again = await post(body);

    expect(again.status).toBe(200);
    expect(await passEnd()).toBe(end);
    expect(
      getSampleStore().accessPassGrants.filter((grant) => grant.orderId === order.id),
    ).toHaveLength(1);
  });

  it("leaves a Paid Order Paid when a failed event arrives after the paid one", async () => {
    const order = await pendingOrder();
    await post(aboutOrder(checkoutPaid, order));

    expect((await post(aboutOrder(paymentFailed, order))).status).toBe(200);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "paid" }]);
  });

  it("makes a Failed Order Paid when a paid event follows", async () => {
    const order = await pendingOrder();
    await post(aboutOrder(paymentFailed, order));
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "failed" }]);

    await post(aboutOrder(checkoutPaid, order));

    expect(stored()).toEqual([{ reference: "AYC-10001", status: "paid" }]);
    expect(await passEnd()).toBe(new Date(BOOT.getTime() + 90 * DAY).toISOString());
  });

  it("acknowledges an event for no Order of ours, ignores it and logs it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await pendingOrder();
    const body = aboutOrder(checkoutPaid, {
      id: "00000000-0000-4000-8000-000000000000",
      reference: "AYC-99999",
    }).replace("cs_FakeCreated0001TestOnly", "cs_SomeoneElses0001");

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "pending" }]);
    expect(warn).toHaveBeenCalledWith(
      "PayMongo event evt_FakeCheckoutPaid0001 (checkout_session.payment.paid) is about no Order here; ignored.",
    );
  });

  it("makes an Expired Order Paid on a late payment, granting its days", async () => {
    const order = await pendingOrder();
    vi.setSystemTime(new Date(BOOT.getTime() + 25 * HOUR));
    getSampleStore().orders = getSampleStore().orders.map((held) => ({
      ...held,
      status: "expired",
      statusChangedAt: new Date().toISOString(),
    }));

    await post(aboutOrder(checkoutPaid, order));

    expect(stored()).toEqual([{ reference: "AYC-10001", status: "paid" }]);
    expect(await passEnd()).toBe(new Date(BOOT.getTime() + 25 * HOUR + 90 * DAY).toISOString());
    expect(getSampleStore().staffActivity.at(-1)).toMatchObject({
      after: { reference: "AYC-10001", paidAfterExpiry: true },
    });
  });

  it("acknowledges an event buying doesn't act on, changing nothing", async () => {
    await pendingOrder();
    const other = structuredClone(paymentFailed);
    other.data.attributes.type = "source.chargeable";

    const response = await post(JSON.stringify(other));

    expect(response.status).toBe(200);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "pending" }]);
    expect(getSampleStore().paymentEvents).toEqual([]);
  });

  it("acknowledges but ignores a live event on a server taking test payments", async () => {
    const order = await pendingOrder();
    const body = aboutOrder(checkoutPaid, order).replace('"livemode":false', '"livemode":true');

    const response = await post(body, signFakeWebhook(body, { mode: "live" }));

    expect(response.status).toBe(200);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "pending" }]);
  });
});

describe("POST /api/paymongo/webhook: refunds (ticket 09)", () => {
  /** Bea's CE 3 months, paid through the fixture checkout, whose payment is pay_FakePaid0001TestOnly. */
  async function paidOrder() {
    const order = await pendingOrder();
    expect((await post(aboutOrder(checkoutPaid, order))).status).toBe(200);
    return order;
  }
  /** The fixture refund of pay_FakePaid0001TestOnly, for this many centavos, under its own event id. */
  function refundOf(amount: number, eventId = refundUpdated.data.id) {
    const event = structuredClone(refundUpdated);
    event.data.id = eventId;
    event.data.attributes.data.attributes.amount = amount;
    return JSON.stringify(event);
  }
  const ninetyDays = () => new Date(BOOT.getTime() + 90 * DAY).toISOString();

  it("refunds a Paid Order in full, ending access now, logged as PayMongo", async () => {
    await paidOrder();
    vi.setSystemTime(BOOT.getTime() + 5 * DAY);

    const response = await post(refundOf(129_900));

    expect(response.status).toBe(200);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "refunded" }]);
    expect(await passEnd()).toBe(new Date(BOOT.getTime() + 5 * DAY).toISOString());
    expect(getSampleStore().staffActivity.at(-1)).toMatchObject({
      actor: { email: "system:paymongo", name: "PayMongo (system)" },
      action: "order-refunded",
      before: { endsAt: ninetyDays() },
    });
  });

  it("finds the Order by the metadata a refunded payment carries", async () => {
    await paidOrder();

    expect((await post(JSON.stringify(paymentRefunded))).status).toBe(200);

    expect(stored()).toEqual([{ reference: "AYC-10001", status: "refunded" }]);
  });

  it("takes the days off once when PayMongo delivers the same refund event twice", async () => {
    await paidOrder();
    vi.setSystemTime(BOOT.getTime() + 5 * DAY);
    await post(refundOf(129_900));
    vi.setSystemTime(BOOT.getTime() + 6 * DAY);

    expect((await post(refundOf(129_900))).status).toBe(200);

    expect(await passEnd()).toBe(new Date(BOOT.getTime() + 5 * DAY).toISOString());
    expect(
      getSampleStore().staffActivity.filter(({ action }) => action === "order-refunded"),
    ).toHaveLength(1);
  });

  it("records a partial refund, leaving the Order Paid and its days", async () => {
    await paidOrder();

    expect((await post(refundOf(30_000))).status).toBe(200);

    expect(stored()).toEqual([{ reference: "AYC-10001", status: "paid" }]);
    expect(await passEnd()).toBe(ninetyDays());
    expect(getSampleStore().orderRefunds).toMatchObject([{ amountCentavos: 30_000 }]);
  });

  it("changes nothing for a refund event with a bad signature", async () => {
    await paidOrder();
    const body = refundOf(129_900);

    const response = await post(body, signFakeWebhook(refundOf(1_000)));

    expect(response.status).toBe(401);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "paid" }]);
    expect(await passEnd()).toBe(ninetyDays());
    expect(getSampleStore().orderRefunds).toEqual([]);
  });

  it("ignores and logs a refund of an Order that was never Paid", async () => {
    const order = await pendingOrder();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const event = structuredClone(paymentRefunded);
    event.data.attributes.data.attributes.metadata = {
      order_id: order.id,
      reference: order.reference,
    };

    const response = await post(JSON.stringify(event));

    expect(response.status).toBe(200);
    expect(stored()).toEqual([{ reference: "AYC-10001", status: "pending" }]);
    expect(getSampleStore().orderRefunds).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "PayMongo event evt_FakePaymentRefunded0001 (payment.refunded) refunds an Order that was never Paid; ignored and logged.",
    );
  });
});
