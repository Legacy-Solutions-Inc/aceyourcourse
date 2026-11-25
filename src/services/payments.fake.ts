import { signPayMongoWebhook, verifyPayMongoWebhook } from "@/lib/paymongo/webhook";
import type { OrderOutcome } from "@/lib/payments/order-ledger";
import type {
  CheckoutOrder,
  CheckoutRef,
  CheckoutStart,
  CheckoutStatus,
  PaymentsClient,
  WebhookCheck,
} from "@/services/payments.types";

// The payments fake (Phase 4, ticket 03): stands in for PayMongo in tests and
// in sample mode, so every screen can be clicked through with no keys and no
// network. Its checkout sends the Member straight to the Confirming payment
// screen (the Order's success path), with no checkout id, unless told to
// refuse, as PayMongo answering an error would. Its status is whatever was
// simulated for the Order ("Simulate paid", "Simulate failed"), pending until
// then. Its webhooks are PayMongo's, checked as the real client checks them
// (webhook.ts) but with a test-only secret, so fixtures are signed with
// signFakeWebhook().

export interface FakePaymentsClient extends PaymentsClient {
  /** The checkouts started, in order. */
  readonly started: readonly CheckoutOrder[];
  /** The statuses asked for, in order. */
  readonly statusChecks: readonly CheckoutRef[];
  /** Refuses every checkout from now on, as PayMongo answering an error would. */
  refuseCheckouts(): void;
  /** Makes an Order's checkout report this outcome from now on. */
  simulate(orderId: string, outcome: SimulatedOutcome): void;
}

/** What the fake's checkout can report: PayMongo's outcomes (Expired is the sweep's own). */
type SimulatedOutcome = Exclude<OrderOutcome, "expired">;

/** The fake's webhook secret: test fixtures only, never a real one. */
const FAKE_WEBHOOK_SECRET = "whsk_fake_webhook_secret_test_only";

/**
 * Pure: a Paymongo-Signature header for a fixture body, signed as PayMongo
 * signs (t, te, li; webhook.ts) with the fake's secret, in test mode unless
 * told otherwise.
 */
export const signFakeWebhook = (
  body: string,
  { mode = "test", t = Math.floor(Date.now() / 1000) }: { mode?: "test" | "live"; t?: number } = {},
): string => signPayMongoWebhook(body, FAKE_WEBHOOK_SECRET, { t, mode });

export function createFakePaymentsClient(): FakePaymentsClient {
  const started: CheckoutOrder[] = [];
  const statusChecks: CheckoutRef[] = [];
  const outcomes = new Map<string, SimulatedOutcome>();
  let refusing = false;
  return {
    kind: "fake",
    livemode: false,
    started,
    statusChecks,
    simulate(orderId, outcome) {
      outcomes.set(orderId, outcome);
    },
    refuseCheckouts() {
      refusing = true;
    },
    async startCheckout(order): Promise<CheckoutStart> {
      if (refusing) return { ok: false };
      started.push(order);
      return { ok: true, checkoutId: null, redirectTo: order.successPath, livemode: false };
    },
    async checkoutStatus(ref): Promise<CheckoutStatus> {
      statusChecks.push(ref);
      const outcome = outcomes.get(ref.orderId);
      return outcome ? { status: outcome, paymentId: null } : { status: "pending" };
    },
    async verifyWebhook(body, signature): Promise<WebhookCheck> {
      return verifyPayMongoWebhook(body, signature, FAKE_WEBHOOK_SECRET);
    },
  };
}
