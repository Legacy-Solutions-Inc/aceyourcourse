import { formatPeso } from "@/lib/money";
import type { PlanDays } from "@/lib/plans/plan-rules";

// ─────────────────────────────────────────────────────────────────────────────
// How a Plan's duration and price read, wherever a Plan is shown: the Admin's
// Plans & prices (ticket 01) and the Member's Plans page (ticket 02); spec,
// Phase 4 → Plans; BUILD-MAP §3.8. A Plan runs 30, 90, 180 or 365 days,
// called 1, 3, 6 or 12 months, and its per-month figure is worked out for
// display only, in whole pesos. A 30-day Plan has no per-month figure: it
// reads "for 30 days".
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS: Record<PlanDays, number> = { 30: 1, 90: 3, 180: 6, 365: 12 };

/** Pure: the duration in months, "3 months" or "1 month". */
export function periodLabel(days: PlanDays): string {
  const months = MONTHS[days];
  return `${months} ${months === 1 ? "month" : "months"}`;
}

/**
 * Pure: the per-month figure beside a price, "₱433 / month", rounded to whole
 * pesos; "for 30 days" for a 30-day Plan; nothing while there's no price.
 */
export function perMonthText(priceCentavos: number | null, days: PlanDays): string {
  if (days === 30) return "for 30 days";
  if (priceCentavos === null) return "";
  const pesos = Math.round(priceCentavos / 100 / MONTHS[days]);
  return `${formatPeso(pesos * 100)} / month`;
}
