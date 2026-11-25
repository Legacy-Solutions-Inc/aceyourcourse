// ─────────────────────────────────────────────────────────────────────────────
// The Payment Methods (CONTEXT.md → Payment Method; spec, Phase 4 planning
// decisions → Paying), pure. The Member picks one on the Plans page; the
// Order records it, PayMongo's checkout opens with only that one (ticket 04),
// and a failed payment names it and offers the other three (BUILD-MAP §3
// Pay failed).
// ─────────────────────────────────────────────────────────────────────────────

/** The methods as stored on an Order (orders.method), in the order the Plans page offers them. */
export const PAYMENT_METHODS = ["qrph", "gcash", "maya", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const LABELS: Record<PaymentMethod, string> = {
  qrph: "QR Ph",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
};

/** Pure: whether a value sent from a form is one of the four. */
export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);

/** Pure: a method as people read it: "QR Ph", "GCash", "Maya" or "Card". */
export const methodLabel = (method: PaymentMethod): string => LABELS[method];

/** Pure: a method in capitals, as the receipt line has it: "QR PH". */
export const methodTag = (method: PaymentMethod): string => LABELS[method].toUpperCase();

/** What the failed payment screen says. */
export interface FailureCopy {
  title: string;
  body: string;
}

/** Pure: "A, B, or C". */
const listOf = (labels: string[]) => `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;

/**
 * Pure: what the failed payment screen says for a method: a declined card,
 * or that method's payment not going through, offering the other three.
 */
export function failureCopy(method: PaymentMethod): FailureCopy {
  const others = PAYMENT_METHODS.filter((other) => other !== method).map(methodLabel);
  return {
    title:
      method === "card"
        ? "Your card was declined"
        : `Your ${methodLabel(method)} payment didn’t go through`,
    body: `You weren’t charged. Try again, or pay with ${listOf(others)} instead.`,
  };
}
