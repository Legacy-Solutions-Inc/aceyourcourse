import { describe, expect, it } from "vitest";

import { createFakePaymentsClient, fakeWebhook, signFakeWebhook } from "./payments.fake";
import type { CheckoutOrder } from "./payments.types";

// The payments fake (Phase 4, ticket 03; Testing Decisions → Phase 4 seams →
// Payments client): stands in for PayMongo in tests and sample mode. Its
// checkout sends the Member straight to the Confirming payment screen, its
// status is whatever was simulated, and its webhooks verify against a
// test-only secret.

const ORDER: CheckoutOrder = {
  orderId: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
  reference: "AYC-10001",
  description: "CE All-Access · 3 months",
  priceCentavos: 129_900,
  method: "gcash",
  buyer: { name: "Bea Tester", email: "tester@example.com" },
  successPath: "/app/plans/orders/AYC-10001",
  cancelPath: "/app/plans?exam=CE",
};
const REF = { orderId: ORDER.orderId, reference: ORDER.reference, checkoutId: null };

describe("the payments fake", () => {
  it("is the fake, with test money only", () => {
    const fake = createFakePaymentsClient();
    expect(fake.kind).toBe("fake");
    expect(fake.livemode).toBe(false);
  });

  it("sends the Member straight to the Confirming payment screen, with no checkout id", async () => {
    const fake = createFakePaymentsClient();
    expect(await fake.startCheckout(ORDER)).toEqual({
      ok: true,
      checkoutId: null,
      redirectTo: "/app/plans/orders/AYC-10001",
      livemode: false,
    });
    expect(fake.started).toEqual([ORDER]);
  });

  it("can refuse to start checkouts, as PayMongo answering an error would", async () => {
    const fake = createFakePaymentsClient();
    fake.refuseCheckouts();
    expect(await fake.startCheckout(ORDER)).toEqual({ ok: false });
    expect(fake.started).toEqual([]);
  });

  it("keeps each status asked for", async () => {
    const fake = createFakePaymentsClient();
    await fake.checkoutStatus(REF);
    expect(fake.statusChecks).toEqual([REF]);
  });

  it("reports a checkout pending until an outcome is simulated", async () => {
    const fake = createFakePaymentsClient();
    expect(await fake.checkoutStatus(REF)).toEqual({ status: "pending" });
  });

  it.each(["paid", "failed"] as const)("reports the simulated outcome: %s", async (outcome) => {
    const fake = createFakePaymentsClient();
    fake.simulate(ORDER.orderId, outcome);
    expect(await fake.checkoutStatus(REF)).toEqual({ status: outcome, paymentId: null });
    // Another Order's checkout is still pending.
    expect(await fake.checkoutStatus({ ...REF, orderId: "other" })).toEqual({
      status: "pending",
    });
  });
});

describe("the payments fake's webhooks", () => {
  const event = {
    id: "evt_fake_1",
    outcome: "paid" as const,
    checkoutId: null,
    orderId: ORDER.orderId,
    paymentId: "pay_fake_1",
    livemode: false,
  };

  it("reads the event of a fixture signed with the test secret", async () => {
    const { body, signature } = fakeWebhook(event);
    expect(await createFakePaymentsClient().verifyWebhook(body, signature)).toEqual({
      ok: true,
      event,
    });
  });

  it("refuses a body changed after signing", async () => {
    const { body, signature } = fakeWebhook(event);
    const tampered = body.replace("evt_fake_1", "evt_fake_2");
    expect(await createFakePaymentsClient().verifyWebhook(tampered, signature)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it.each([null, "", "nonsense"])("refuses the signature %j", async (signature) => {
    const { body } = fakeWebhook(event);
    expect(await createFakePaymentsClient().verifyWebhook(body, signature)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("refuses a signed body that isn't an event", async () => {
    const body = JSON.stringify({ hello: "there" });
    expect(await createFakePaymentsClient().verifyWebhook(body, signFakeWebhook(body))).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("refuses a signed body that isn't JSON", async () => {
    const body = "{not json";
    expect(await createFakePaymentsClient().verifyWebhook(body, signFakeWebhook(body))).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});
