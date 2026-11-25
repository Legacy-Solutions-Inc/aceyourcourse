// @vitest-environment node
import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import checkoutPaid from "../../../test/fixtures/paymongo/event-checkout-paid.json";
import paymentFailed from "../../../test/fixtures/paymongo/event-payment-failed.json";
import paymentPaid from "../../../test/fixtures/paymongo/event-payment-paid.json";
import refundUpdated from "../../../test/fixtures/paymongo/event-refund-updated.json";

import { signPayMongoWebhook, verifyPayMongoWebhook } from "./webhook";

// PayMongo's webhooks (Phase 4, ticket 05; docs.paymongo.com → Developer
// Tools → Webhooks → Setup & Management, "Securing a webhook"; Events). Each
// request carries `Paymongo-Signature: t=<timestamp>,te=<test>,li=<live>`,
// the HMAC-SHA256 of "<t>.<raw body>" with the webhook's secret: te for a
// test event, li for a live one. A verified body is read as an event buying
// acts on (a paid checkout, a paid or failed payment) or one it ignores.

const SECRET = "whsk_TestOnlySecret0001";
const T = 1_763_351_102;
const body = (event: unknown) => JSON.stringify(event);
const CHECKOUT_PAID = body(checkoutPaid);

/** A live copy of a fixture event. */
const live = (event: typeof checkoutPaid) => ({
  data: { ...event.data, attributes: { ...event.data.attributes, livemode: true } },
});

describe("signPayMongoWebhook", () => {
  it("signs '<t>.<raw body>' with HMAC-SHA256 in te for a test event, li empty", () => {
    const expected = createHmac("sha256", SECRET).update(`${T}.${CHECKOUT_PAID}`).digest("hex");
    expect(signPayMongoWebhook(CHECKOUT_PAID, SECRET, { t: T, mode: "test" })).toBe(
      `t=${T},te=${expected},li=`,
    );
  });

  it("signs in li for a live event, te empty", () => {
    expect(signPayMongoWebhook(CHECKOUT_PAID, SECRET, { t: T, mode: "live" })).toMatch(
      new RegExp(`^t=${T},te=,li=[0-9a-f]{64}$`),
    );
  });
});

describe("verifyPayMongoWebhook: the signature", () => {
  const signed = (raw: string, mode: "test" | "live" = "test", secret = SECRET) =>
    signPayMongoWebhook(raw, secret, { t: T, mode });

  it("accepts a test event signed in te", () => {
    expect(verifyPayMongoWebhook(CHECKOUT_PAID, signed(CHECKOUT_PAID), SECRET)).toMatchObject({
      ok: true,
    });
  });

  it("accepts a live event signed in li", () => {
    const raw = body(live(checkoutPaid));
    expect(verifyPayMongoWebhook(raw, signed(raw, "live"), SECRET)).toMatchObject({
      ok: true,
      event: { livemode: true },
    });
  });

  it("refuses a signature made with another secret", () => {
    expect(
      verifyPayMongoWebhook(CHECKOUT_PAID, signed(CHECKOUT_PAID, "test", "whsk_Other"), SECRET),
    ).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuses a body changed after signing", () => {
    const tampered = CHECKOUT_PAID.replace("AYC-10001", "AYC-10002");
    expect(verifyPayMongoWebhook(tampered, signed(CHECKOUT_PAID), SECRET)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("refuses a signature over another timestamp", () => {
    const header = signed(CHECKOUT_PAID).replace(`t=${T}`, `t=${T + 1}`);
    expect(verifyPayMongoWebhook(CHECKOUT_PAID, header, SECRET)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["a header that isn't PayMongo's", "nonsense"],
    ["no timestamp", "te=abc,li="],
    ["no signature", `t=${T},te=,li=`],
    ["a signature that isn't hex", `t=${T},te=${"z".repeat(64)},li=`],
    ["a short signature", `t=${T},te=abc,li=`],
  ])("refuses %s", (_what, header) => {
    expect(verifyPayMongoWebhook(CHECKOUT_PAID, header, SECRET)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("refuses a live event signed only as a test one", () => {
    const raw = body(live(checkoutPaid));
    expect(verifyPayMongoWebhook(raw, signed(raw, "test"), SECRET)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("refuses a test event signed only as a live one", () => {
    expect(verifyPayMongoWebhook(CHECKOUT_PAID, signed(CHECKOUT_PAID, "live"), SECRET)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("refuses everything with no secret", () => {
    expect(verifyPayMongoWebhook(CHECKOUT_PAID, signed(CHECKOUT_PAID), "")).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });
});

describe("verifyPayMongoWebhook: the event", () => {
  const read = (event: unknown) => {
    const raw = typeof event === "string" ? event : body(event);
    return verifyPayMongoWebhook(
      raw,
      signPayMongoWebhook(raw, SECRET, { t: T, mode: "test" }),
      SECRET,
    );
  };

  it("reads a paid checkout: its session, our Order's id and reference, and the paid payment", () => {
    expect(read(checkoutPaid)).toEqual({
      ok: true,
      event: {
        id: "evt_FakeCheckoutPaid0001",
        type: "checkout_session.payment.paid",
        outcome: "paid",
        checkoutId: "cs_FakeCreated0001TestOnly",
        orderId: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
        reference: "AYC-10001",
        paymentId: "pay_FakePaid0001TestOnly",
        livemode: false,
      },
    });
  });

  it("reads a paid payment by the metadata its checkout gave it", () => {
    expect(read(paymentPaid)).toEqual({
      ok: true,
      event: {
        id: "evt_FakePaymentPaid0001",
        type: "payment.paid",
        outcome: "paid",
        checkoutId: null,
        orderId: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
        reference: "AYC-10001",
        paymentId: "pay_FakePaid0001TestOnly",
        livemode: false,
      },
    });
  });

  it("reads a failed payment", () => {
    expect(read(paymentFailed)).toMatchObject({
      ok: true,
      event: {
        id: "evt_FakePaymentFailed0001",
        type: "payment.failed",
        outcome: "failed",
        paymentId: "pay_FakeFailed0001TestOnly",
      },
    });
  });

  it("verifies but ignores an event buying doesn't act on, naming its type", () => {
    expect(read(refundUpdated)).toEqual({
      ok: true,
      event: null,
      id: "evt_FakeRefund0001",
      type: "payment.refund.updated",
    });
  });

  it("reads a checkout or payment with no metadata as about no Order of ours", () => {
    const bare = structuredClone(paymentPaid);
    delete (bare.data.attributes.data.attributes as { metadata?: unknown }).metadata;
    expect(read(bare)).toMatchObject({ ok: true, event: { orderId: null, reference: null } });
  });

  it.each([
    ["JSON that isn't an event", { hello: "there" }],
    ["a body that isn't JSON", "{not json"],
    ["an event with no id", { data: { type: "event", attributes: checkoutPaid.data.attributes } }],
    [
      "a paid checkout with no session id",
      {
        data: {
          ...checkoutPaid.data,
          attributes: {
            ...checkoutPaid.data.attributes,
            data: { ...checkoutPaid.data.attributes.data, id: 42 },
          },
        },
      },
    ],
  ])("refuses %s as malformed", (_what, event) => {
    expect(read(event)).toEqual({ ok: false, reason: "malformed" });
  });
});
