import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type { OrderOutcome } from "@/lib/payments/order-ledger";
import type {
  CheckoutOrder,
  CheckoutStatus,
  PaymentEvent,
  PaymentsClient,
  WebhookCheck,
} from "@/services/payments.types";

// The payments fake (Phase 4, ticket 03): stands in for PayMongo in tests and
// in sample mode, so every screen can be clicked through with no keys and no
// network. Its checkout sends the Member straight to the Confirming payment
// screen (the Order's success path), with no checkout id. Its status is
// whatever was simulated for the Order ("Simulate paid", "Simulate failed"),
// pending until then. Its webhooks are signed with a test-only secret, so
// fixtures can be made with fakeWebhook().

export interface FakePaymentsClient extends PaymentsClient {
  /** The checkouts started, in order. */
  readonly started: readonly CheckoutOrder[];
  /** Makes an Order's checkout report this outcome from now on. */
  simulate(orderId: string, outcome: OrderOutcome): void;
}

/** The fake's webhook secret: test fixtures only, never a real one. */
const FAKE_WEBHOOK_SECRET = "fake-webhook-secret-test-only";

/** Pure: the fake's signature of a webhook's raw body. */
export const signFakeWebhook = (body: string): string =>
  createHmac("sha256", FAKE_WEBHOOK_SECRET).update(body).digest("hex");

/** A fixture webhook: an event's body and its signature. */
export function fakeWebhook(event: PaymentEvent): { body: string; signature: string } {
  const body = JSON.stringify(event);
  return { body, signature: signFakeWebhook(body) };
}

const eventSchema = z.object({
  id: z.string().min(1),
  outcome: z.enum(["paid", "failed"]),
  checkoutId: z.string().nullable(),
  orderId: z.string().nullable(),
  paymentId: z.string().nullable(),
  livemode: z.boolean(),
});

/** Whether a signature is the fake's for this body, compared in constant time. */
function signedByFake(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signFakeWebhook(body));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function readEvent(body: string): PaymentEvent | null {
  try {
    const parsed = eventSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function createFakePaymentsClient(): FakePaymentsClient {
  const started: CheckoutOrder[] = [];
  const outcomes = new Map<string, OrderOutcome>();
  return {
    kind: "fake",
    livemode: false,
    started,
    simulate(orderId, outcome) {
      outcomes.set(orderId, outcome);
    },
    async startCheckout(order) {
      started.push(order);
      return { checkoutId: null, redirectTo: order.successPath };
    },
    async checkoutStatus({ orderId }): Promise<CheckoutStatus> {
      const outcome = outcomes.get(orderId);
      return outcome ? { status: outcome, paymentId: null } : { status: "pending" };
    },
    async verifyWebhook(body, signature): Promise<WebhookCheck> {
      if (!signedByFake(body, signature)) return { ok: false, reason: "bad-signature" };
      const event = readEvent(body);
      return event ? { ok: true, event } : { ok: false, reason: "malformed" };
    },
  };
}
