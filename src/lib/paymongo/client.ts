import "server-only";

import { z } from "zod";

import { PAYMONGO_CHECKOUT_ORIGIN } from "@/lib/paymongo/checkout-origin";
import { verifyPayMongoWebhook } from "@/lib/paymongo/webhook";
import type { PaymentMethod } from "@/lib/payments/payment-methods";
import type {
  CheckoutOrder,
  CheckoutRef,
  CheckoutStart,
  CheckoutStatus,
  PaymentsClient,
} from "@/services/payments.types";

// ─────────────────────────────────────────────────────────────────────────────
// The real payments client (Phase 4, ticket 04; spec, Phase 4 → PayMongo
// integration; Phase 4 planning decisions → Paying, Recording an outcome),
// over PayMongo's Checkout Session API with fetch (no SDK):
// - startCheckout: one Checkout Session per Order, with the Plan as its one
//   line item, only the Payment Method the Member picked, the return
//   addresses on this site, the Order's reference, and PayMongo's own email
//   receipt on. It sends the Member only to an https page on PayMongo's
//   checkout host.
// - checkoutStatus: reads the Order's session. Paid once one of its payments
//   is paid; otherwise still pending, as a failed try can be retried on the
//   same page (PayMongo, Key concepts → Payment attempts and retries). An
//   answer about another session or another Order's reference is ignored.
// - verifyWebhook (ticket 05): checks PayMongo's signature with the
//   webhook's secret (PAYMONGO_WEBHOOK_SECRET) and reads the event
//   (webhook.ts). Without the secret, every webhook is refused.
// The secret key is the Basic auth username, with no password. It stays on
// the server: this module is server-only, and nothing it logs or answers
// carries the key or PayMongo's raw response.
//
// PayMongo docs (read 2026-11-25):
// - https://docs.paymongo.com/docs/payment-channels-hosted-checkout
// - https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start
// - https://docs.paymongo.com/reference/checkout-session-resource
// - https://docs.paymongo.com/reference/retrieve-a-checkout
// - https://docs.paymongo.com/docs/payment-acceptance-e-wallets (Maya is "paymaya")
// - https://docs.paymongo.com/docs/developer-tools-error-handling
// ─────────────────────────────────────────────────────────────────────────────

const PAYMONGO_API = "https://api.paymongo.com/v1";

/** How long a call to PayMongo may take before it counts as unreachable. */
const TIMEOUT_MS = 15_000;

const PAYMONGO_METHODS: Record<PaymentMethod, string> = {
  qrph: "qrph",
  gcash: "gcash",
  maya: "paymaya",
  card: "card",
};

/** Pure: a Payment Method as PayMongo's payment_method_types name it. */
export const payMongoMethod = (method: PaymentMethod): string => PAYMONGO_METHODS[method];

export interface PayMongoClientOptions {
  /** PAYMONGO_SECRET_KEY: sk_test_… or sk_live_…. */
  secretKey: string;
  /** PAYMONGO_WEBHOOK_SECRET: what PayMongo signs its webhooks with; without it, every webhook is refused. */
  webhookSecret?: string;
  /** This site's address, which the return addresses are built on. */
  siteUrl: string;
  fetch?: typeof globalThis.fetch;
  /** Where problems are logged (never with the key). */
  log?: (message: string) => void;
}

const sessionSchema = z.object({
  data: z.object({
    id: z.string().startsWith("cs_"),
    attributes: z.object({
      checkout_url: z.string(),
      livemode: z.boolean(),
      reference_number: z.string().nullish(),
      payments: z
        .array(z.object({ id: z.string(), attributes: z.object({ status: z.string() }) }))
        .nullish(),
    }),
  }),
});

const errorsSchema = z.object({ errors: z.array(z.object({ code: z.string() })) });

/** Pure: whether an address is an https page on PayMongo's checkout host. */
function onPayMongoCheckout(address: string): boolean {
  try {
    const url = new URL(address);
    return url.protocol === "https:" && url.origin === PAYMONGO_CHECKOUT_ORIGIN;
  } catch {
    return false;
  }
}

type Answer = { ok: true; body: unknown } | { ok: false; why: string };

export function createPayMongoClient({
  secretKey,
  webhookSecret = "",
  siteUrl,
  fetch = globalThis.fetch,
  log = (message) => console.error(message),
}: PayMongoClientOptions): PaymentsClient {
  const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
  const absolute = (path: string) => new URL(path, siteUrl).toString();

  /** One call to PayMongo: its JSON, or why not, in words safe to log. */
  async function call(path: string, init: RequestInit = {}): Promise<Answer> {
    let response: Response;
    try {
      response = await fetch(`${PAYMONGO_API}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          authorization,
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return { ok: false, why: "it couldn't be reached" };
    }
    const body: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, body };
    const errors = errorsSchema.safeParse(body);
    const codes = errors.success ? errors.data.errors.map((error) => error.code).join(", ") : "";
    return { ok: false, why: `HTTP ${response.status}${codes ? `: ${codes}` : ""}` };
  }

  async function startCheckout(order: CheckoutOrder): Promise<CheckoutStart> {
    const refuse = (why: string): CheckoutStart => {
      log(`PayMongo didn't start the checkout for ${order.reference} (${why}).`);
      return { ok: false };
    };
    const answer = await call("/checkout_sessions", {
      method: "POST",
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: order.description,
                amount: order.priceCentavos,
                currency: "PHP",
                quantity: 1,
              },
            ],
            payment_method_types: [payMongoMethod(order.method)],
            description: order.description,
            success_url: absolute(order.successPath),
            cancel_url: absolute(order.cancelPath),
            reference_number: order.reference,
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            metadata: { order_id: order.orderId, reference: order.reference },
          },
        },
      }),
    });
    if (!answer.ok) return refuse(answer.why);
    const session = sessionSchema.safeParse(answer.body);
    if (!session.success) return refuse("its answer wasn't a Checkout Session");
    const { id, attributes } = session.data.data;
    if (!onPayMongoCheckout(attributes.checkout_url)) {
      return refuse(`its checkout address isn't on ${PAYMONGO_CHECKOUT_ORIGIN}`);
    }
    return {
      ok: true,
      checkoutId: id,
      redirectTo: attributes.checkout_url,
      livemode: attributes.livemode,
    };
  }

  async function checkoutStatus({ reference, checkoutId }: CheckoutRef): Promise<CheckoutStatus> {
    if (!checkoutId) return { status: "unknown" };
    const answer = await call(`/checkout_sessions/${encodeURIComponent(checkoutId)}`);
    if (!answer.ok) {
      log(`PayMongo didn't give the status for ${reference} (${answer.why}).`);
      return { status: "unknown" };
    }
    const session = sessionSchema.safeParse(answer.body);
    if (!session.success) {
      log(
        `PayMongo didn't give the status for ${reference} (its answer wasn't a Checkout Session).`,
      );
      return { status: "unknown" };
    }
    const { id, attributes } = session.data.data;
    if (id !== checkoutId || attributes.reference_number !== reference) {
      log(`PayMongo's status for ${reference} was about another checkout, so it was ignored.`);
      return { status: "unknown" };
    }
    const paidPayment = (attributes.payments ?? []).find(
      (payment) => payment.attributes.status === "paid",
    );
    return paidPayment ? { status: "paid", paymentId: paidPayment.id } : { status: "pending" };
  }

  return {
    kind: "paymongo",
    livemode: secretKey.startsWith("sk_live_"),
    startCheckout,
    checkoutStatus,
    async verifyWebhook(rawBody, signature) {
      return verifyPayMongoWebhook(rawBody, signature, webhookSecret);
    },
  };
}
