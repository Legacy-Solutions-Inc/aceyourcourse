// ─────────────────────────────────────────────────────────────────────────────
// A Plan's rules that need nothing but the Plan (Phase 4, ticket 01; spec,
// Phase 4 → Plans; Phase 4 planning decisions → Plans & prices): it runs 30,
// 90, 180 or 365 days, and costs whole pesos from ₱1 to ₱99,999, stored in
// centavos. PayMongo's public docs give ₱1 as the least most Payment Methods
// take, QR Ph, GCash, Maya and cards among them, so ₱1 stays the floor. The
// Admin's schema (admin.schema.ts) and the editor's preview (plan-view.ts)
// both read prices with parsePlanPrice.
// ─────────────────────────────────────────────────────────────────────────────

/** Every duration a Plan can have, in days, shortest first. */
export const PLAN_DAYS = [30, 90, 180, 365] as const;

export type PlanDays = (typeof PLAN_DAYS)[number];

/** Pure: whether `days` is one of a Plan's durations. */
export const isPlanDays = (days: unknown): days is PlanDays =>
  (PLAN_DAYS as readonly unknown[]).includes(days);

/** Pure: a stored duration as a Plan's: the database's check keeps it to one. Throws for any other. */
export function toPlanDays(days: number): PlanDays {
  if (!isPlanDays(days)) throw new RangeError(`${days} days isn't a Plan's duration`);
  return days;
}

export const PLAN_PRICE_MIN_PESOS = 1;
export const PLAN_PRICE_MAX_PESOS = 99_999;

const pesos = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

export const PLAN_PRICE_MISSING = "ENTER A PRICE IN WHOLE PESOS, LIKE 1,299";
export const PLAN_PRICE_WHOLE = "USE WHOLE PESOS · NO CENTAVOS";
export const PLAN_PRICE_TOO_LOW = `A PRICE MUST BE AT LEAST ₱${pesos.format(PLAN_PRICE_MIN_PESOS)}`;
export const PLAN_PRICE_TOO_HIGH = `A PRICE CAN’T BE OVER ₱${pesos.format(PLAN_PRICE_MAX_PESOS)}`;

/**
 * Pure: a price as typed ("₱1,299", "1299") or sent (1299), in pesos: its
 * centavos, or the message saying why it isn't a Plan's price.
 */
export function parsePlanPrice(
  value: unknown,
): { ok: true; centavos: number } | { ok: false; message: string } {
  const refuse = (message: string) => ({ ok: false as const, message });
  if (typeof value !== "string" && typeof value !== "number") return refuse(PLAN_PRICE_MISSING);
  const text = typeof value === "number" ? String(value) : value.replace(/[₱,\s]/g, "");
  if (/^-\d/.test(text)) return refuse(PLAN_PRICE_TOO_LOW);
  if (/^\d*\.\d+$/.test(text)) return refuse(PLAN_PRICE_WHOLE);
  if (!/^\d{1,9}$/.test(text)) return refuse(PLAN_PRICE_MISSING);
  const amount = Number(text);
  if (amount < PLAN_PRICE_MIN_PESOS) return refuse(PLAN_PRICE_TOO_LOW);
  if (amount > PLAN_PRICE_MAX_PESOS) return refuse(PLAN_PRICE_TOO_HIGH);
  return { ok: true, centavos: amount * 100 };
}

/** Pure: the default name of an Exam's Plan, "CE All-Access", as the starting Plans have it. */
export const defaultPlanName = (examCode: string) => `${examCode} All-Access`;
