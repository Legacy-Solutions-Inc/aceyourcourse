import type { OrderOutcome } from "@/lib/payments/order-ledger";
import type { PaymentMethod } from "@/lib/payments/payment-methods";

// ─────────────────────────────────────────────────────────────────────────────
// The payments client (Phase 4, ticket 03; spec, Phase 4 → PayMongo
// integration; Testing Decisions → Phase 4 seams → Payments client): what
// buying asks of PayMongo, behind one small interface, like the auth admin
// (auth-admin.types.ts). Three jobs: start a checkout for an Order, read a
// checkout's status, and verify a webhook and read its event. The fake
// (payments.fake.ts) stands in for it in tests and in sample mode, where it
// also drives "Simulate paid" and "Simulate failed"; the real PayMongo client
// (ticket 04, src/lib/paymongo/client.ts) works on test or live keys. The
// selector (payments.ts) says which, if any, this server has.
// ─────────────────────────────────────────────────────────────────────────────

/** What a checkout is started with: one Order, as it was made at Pay. */
export interface CheckoutOrder {
  orderId: string;
  reference: string;
  /** The line the checkout shows: "CE All-Access · 3 months". */
  description: string;
  priceCentavos: number;
  /** The only method the checkout offers. */
  method: PaymentMethod;
  buyer: { name: string | null; email: string };
  /** Where the Member comes back to: the Confirming payment screen, and Plans on a cancel. */
  successPath: string;
  cancelPath: string;
}

/**
 * A checkout started: where to send the Member, the provider's id for it
 * (null with the fake) and whether it takes real money; or not started,
 * because the provider refused or couldn't be reached (the Order stays
 * Pending, and the Member stays on Plans).
 */
export type CheckoutStart =
  { ok: true; checkoutId: string | null; redirectTo: string; livemode: boolean } | { ok: false };

/** Which checkout to ask about: an Order, its reference, and its checkout's id where the provider gave one. */
export interface CheckoutRef {
  orderId: string;
  reference: string;
  checkoutId: string | null;
}

/**
 * A checkout's status as the provider reports it; "unknown" when it couldn't
 * say (no checkout id, an error, or an answer about another Order's checkout),
 * which changes nothing.
 */
export type CheckoutStatus =
  | { status: "pending" }
  | { status: "unknown" }
  | { status: "paid"; paymentId: string | null }
  | { status: "failed"; paymentId: string | null };

/** A webhook's event, once its signature checks out. */
export interface PaymentEvent {
  /** The provider's event id: each event is applied once (ticket 05). */
  id: string;
  outcome: OrderOutcome;
  /** The Order it's about, by its checkout's id and our id. */
  checkoutId: string | null;
  orderId: string | null;
  paymentId: string | null;
  livemode: boolean;
}

/** A webhook checked: its event, or why it was refused (nothing is applied then). */
export type WebhookCheck =
  { ok: true; event: PaymentEvent } | { ok: false; reason: "bad-signature" | "malformed" };

export interface PaymentsClient {
  /** Which client this is: "fake" in tests and sample mode, "paymongo" with a key. */
  readonly kind: "fake" | "paymongo";
  /** Whether payments are real money: false for test payments and the fake. */
  readonly livemode: boolean;
  /** Starts a checkout for an Order, giving where to send the Member. Never throws. */
  startCheckout(order: CheckoutOrder): Promise<CheckoutStart>;
  /** Reads a checkout's status now. Never throws. */
  checkoutStatus(ref: CheckoutRef): Promise<CheckoutStatus>;
  /** Checks a webhook's signature over its raw body, then reads its event. Never throws. */
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookCheck>;
}
