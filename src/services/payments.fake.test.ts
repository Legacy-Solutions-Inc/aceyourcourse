import { describe, expect, it } from "vitest";

import checkoutPaid from "../../test/fixtures/paymongo/event-checkout-paid.json";

import { createFakePaymentsClient, signFakeWebhook } from "./payments.fake";
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
  const body = JSON.stringify(checkoutPaid);

  it("reads a PayMongo event signed with the fake's test secret", async () => {
    expect(
      await createFakePaymentsClient().verifyWebhook(body, signFakeWebhook(body)),
    ).toMatchObject({
      ok: true,
      event: { id: "evt_FakeCheckoutPaid0001", outcome: "paid", livemode: false },
    });
  });

  it("signs as PayMongo does: t, te for a test event, li empty", () => {
    expect(signFakeWebhook(body, { t: 1_763_351_102 })).toMatch(
      /^t=1763351102,te=[0-9a-f]{64},li=$/,
    );
  });

  it("refuses a body changed after signing", async () => {
    const signature = signFakeWebhook(body);
    const tampered = body.replace("AYC-10001", "AYC-10002");
    expect(await createFakePaymentsClient().verifyWebhook(tampered, signature)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it.each([null, "", "nonsense"])("refuses the signature %j", async (signature) => {
    expect(await createFakePaymentsClient().verifyWebhook(body, signature)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("refuses a signed body that isn't an event", async () => {
    const other = JSON.stringify({ hello: "there" });
    expect(await createFakePaymentsClient().verifyWebhook(other, signFakeWebhook(other))).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});
