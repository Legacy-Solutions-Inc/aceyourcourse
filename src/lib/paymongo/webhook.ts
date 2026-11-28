import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { type PaymentRefund, REFUND_STATUSES, type RefundStatus } from "@/lib/payments/refunds";
import type { PaymentEvent, WebhookCheck } from "@/services/payments.types";

// ─────────────────────────────────────────────────────────────────────────────
// PayMongo's webhooks, checked and read (Phase 4, ticket 05). Pure, so the
// real client and the payments fake verify the same way, each with its own
// secret.
//
// - The signature (docs.paymongo.com/docs/developer-tools-webhook-setup-
//   management, "Securing a webhook"): `Paymongo-Signature: t=<timestamp>,
//   te=<test signature>,li=<live signature>`, each the HMAC-SHA256 of
//   "<t>.<raw body>" with the webhook's secret, hex. A test event is signed
//   in te, a live one in li; an event whose livemode disagrees with where it
//   was signed is refused. Compared in constant time.
// - The events (docs.paymongo.com/docs/developer-tools-webhooks-events):
//   `{ data: { id: "evt_…", type: "event", attributes: { type, livemode,
//   data } } }`. Buying acts on these:
//   - checkout_session.payment.paid: a Checkout Session, with its id, our
//     reference_number and metadata, and the paid payment among its payments;
//   - payment.paid and payment.failed: a payment, carrying the metadata its
//     Checkout Session gave it (our Order's id and reference);
//   - payment.refunded and payment.refund.updated (ticket 09;
//     docs.paymongo.com/reference/webhook-resource): read by the resource
//     they carry. A refund (docs.paymongo.com/reference/refund-resource:
//     "ref_…", amount in centavos, status, payment_id, refunded_at; the
//     events page's sample for payment.refund.updated) names its payment;
//     a payment names our Order in its metadata and lists its refunds. The
//     docs show no sample for payment.refunded, so either is read, and a
//     listed refund that can't be read is skipped. A status PayMongo adds
//     later reads as pending, which counts for nothing.
//   Any other type is verified and acknowledged, but changes nothing.
// ─────────────────────────────────────────────────────────────────────────────

/** Pure: the HMAC-SHA256 of "<t>.<raw body>" with the secret, hex. */
const hmac = (t: string, rawBody: string, secret: string) =>
  createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");

/** Pure: a Paymongo-Signature header for a body, as PayMongo signs it (fixtures and the fake). */
export function signPayMongoWebhook(
  rawBody: string,
  secret: string,
  { t, mode }: { t: number; mode: "test" | "live" },
): string {
  const signature = hmac(String(t), rawBody, secret);
  return `t=${t},te=${mode === "test" ? signature : ""},li=${mode === "live" ? signature : ""}`;
}

const SIGNATURE = /^[0-9a-f]{64}$/;

/** Pure: the header's parts, or null when it isn't PayMongo's. */
function headerParts(header: string | null) {
  if (!header) return null;
  const parts = new Map(
    header.split(",").map((part) => {
      const at = part.indexOf("=");
      return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const;
    }),
  );
  const t = parts.get("t") ?? "";
  if (!/^\d+$/.test(t)) return null;
  return { t, te: parts.get("te") ?? "", li: parts.get("li") ?? "" };
}

/** Pure: whether a hex signature matches the expected one, in constant time. */
function matches(given: string, expected: string): boolean {
  if (!SIGNATURE.test(given)) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

/** Pure: where the body was signed with this secret, "test" or "live", or null when it wasn't. */
function signedAs(rawBody: string, header: string | null, secret: string): "test" | "live" | null {
  const parts = headerParts(header);
  if (!secret || !parts) return null;
  const expected = hmac(parts.t, rawBody, secret);
  if (matches(parts.te, expected)) return "test";
  if (matches(parts.li, expected)) return "live";
  return null;
}

const metadataSchema = z
  .object({ order_id: z.string().optional(), reference: z.string().optional() })
  .passthrough()
  .nullish();

const paymentSchema = z.object({
  id: z.string().min(1),
  attributes: z.object({ status: z.string(), metadata: metadataSchema }).passthrough(),
});

const checkoutSchema = z.object({
  id: z.string().min(1),
  attributes: z
    .object({
      reference_number: z.string().nullish(),
      metadata: metadataSchema,
      payments: z.array(paymentSchema).nullish(),
    })
    .passthrough(),
});

/** Pure: PayMongo's seconds since 1970 as an ISO time; null for none. */
const isoOf = (seconds: number | null | undefined) =>
  typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;

const isRefundStatus = (status: string): status is RefundStatus =>
  (REFUND_STATUSES as readonly string[]).includes(status);

const refundSchema = z.object({
  id: z.string().min(1),
  type: z.literal("refund"),
  attributes: z
    .object({
      amount: z.number().int().positive(),
      payment_id: z.string().min(1),
      status: z.string(),
      refunded_at: z.number().nullish(),
      updated_at: z.number().nullish(),
      metadata: metadataSchema,
    })
    .passthrough(),
});

const refundedPaymentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("payment"),
  attributes: z
    .object({ metadata: metadataSchema, refunds: z.array(z.unknown()).nullish() })
    .passthrough(),
});

/**
 * Pure: a refund resource as an Order records it: a status it doesn't know
 * is pending, and a succeeded one's time is PayMongo's refunded_at, or its
 * last update when there's none.
 */
function refundOf({ id, attributes }: z.infer<typeof refundSchema>): PaymentRefund {
  const status = isRefundStatus(attributes.status) ? attributes.status : "pending";
  return {
    id,
    amountCentavos: attributes.amount,
    status,
    refundedAt:
      status === "succeeded"
        ? (isoOf(attributes.refunded_at) ?? isoOf(attributes.updated_at))
        : null,
  };
}

/** Pure: a refund event's resource: a refund, or a refunded payment with its refunds; null when it's neither. */
function readRefunds(data: unknown) {
  const refund = refundSchema.safeParse(data);
  if (refund.success) {
    const { metadata, payment_id } = refund.data.attributes;
    return {
      orderId: metadata?.order_id ?? null,
      reference: metadata?.reference ?? null,
      paymentId: payment_id,
      refunds: [refundOf(refund.data)],
    };
  }
  const payment = refundedPaymentSchema.safeParse(data);
  if (!payment.success) return null;
  const { metadata, refunds } = payment.data.attributes;
  return {
    orderId: metadata?.order_id ?? null,
    reference: metadata?.reference ?? null,
    paymentId: payment.data.id,
    refunds: (refunds ?? []).flatMap((listed) => {
      const read = refundSchema.safeParse(listed);
      return read.success ? [refundOf(read.data)] : [];
    }),
  };
}

const REFUND_EVENTS: ReadonlySet<string> = new Set(["payment.refunded", "payment.refund.updated"]);

const eventSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({ type: z.string().min(1), livemode: z.boolean(), data: z.unknown() }),
  }),
});

type Read =
  | { kind: "event"; event: PaymentEvent }
  | { kind: "other"; id: string; type: string; livemode: boolean }
  | { kind: "malformed" };

/** Pure: a verified body as an event buying acts on, one it doesn't, or not an event at all. */
function readEvent(rawBody: string): Read {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { kind: "malformed" };
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return { kind: "malformed" };
  const { id, attributes } = parsed.data.data;
  const { type, livemode, data } = attributes;
  const base = { id, type, livemode };

  if (type === "checkout_session.payment.paid") {
    const session = checkoutSchema.safeParse(data);
    if (!session.success) return { kind: "malformed" };
    const { metadata, reference_number, payments } = session.data.attributes;
    const paid = (payments ?? []).find((payment) => payment.attributes.status === "paid");
    return {
      kind: "event",
      event: {
        ...base,
        outcome: "paid",
        checkoutId: session.data.id,
        orderId: metadata?.order_id ?? null,
        reference: metadata?.reference ?? reference_number ?? null,
        paymentId: paid?.id ?? null,
      },
    };
  }
  if (type === "payment.paid" || type === "payment.failed") {
    const payment = paymentSchema.safeParse(data);
    if (!payment.success) return { kind: "malformed" };
    const { metadata } = payment.data.attributes;
    return {
      kind: "event",
      event: {
        ...base,
        outcome: type === "payment.paid" ? "paid" : "failed",
        checkoutId: null,
        orderId: metadata?.order_id ?? null,
        reference: metadata?.reference ?? null,
        paymentId: payment.data.id,
      },
    };
  }
  if (REFUND_EVENTS.has(type)) {
    const refunded = readRefunds(data);
    if (!refunded) return { kind: "malformed" };
    return { kind: "event", event: { ...base, outcome: "refund", checkoutId: null, ...refunded } };
  }
  return { kind: "other", ...base };
}

/**
 * Pure: a webhook checked with the endpoint's secret: its event, an event
 * buying ignores, or why it was refused (nothing is applied then).
 */
export function verifyPayMongoWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): WebhookCheck {
  const mode = signedAs(rawBody, signature, secret);
  if (!mode) return { ok: false, reason: "bad-signature" };
  const read = readEvent(rawBody);
  if (read.kind === "malformed") return { ok: false, reason: "malformed" };
  const livemode = read.kind === "event" ? read.event.livemode : read.livemode;
  if (livemode !== (mode === "live")) return { ok: false, reason: "bad-signature" };
  return read.kind === "event"
    ? { ok: true, event: read.event }
    : { ok: true, event: null, id: read.id, type: read.type };
}
