import { isPromoActive } from "@/lib/catalogue/promo";
import { isCalendarDate, manilaDayStart } from "@/lib/manila-time";
import type { PromoBanner } from "@/services/catalogue.types";

// The Home promo banner's status line in Pages & promo (spec, Phase 2 →
// Exam pages & promo). Whether it's on is the Website's own rule,
// isPromoActive, so the Admin never says ON while Home shows no strip.

/** Where the banner is: showing on Home, waiting for its start, past its end, or turned off. */
export type PromoStatusKind = "on" | "scheduled" | "ended" | "off";

export interface PromoStatus {
  kind: PromoStatusKind;
  /** "ON · SHOWS 9–11 NOV", "SCHEDULED · STARTS 9 NOV", "ENDED · TURNED OFF BY ITSELF 11 NOV" or "OFF". */
  line: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Pure: a YYYY-MM-DD date's day, month and year, read as written (it's already a Manila date). */
function partsOf(isoDate: string) {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  return { year, month: MONTHS[month - 1] ?? "", day };
}

/** Pure: "2026-11-11" → "11 Nov". */
export function dayMonth(isoDate: string): string {
  const { day, month } = partsOf(isoDate);
  return `${day} ${month}`;
}

/** Pure: the days a banner runs, "9–11 Nov", "28 Oct–12 Nov", or with years across two. */
function span(startDate: string, endDate: string): string {
  if (startDate === endDate) return dayMonth(startDate);
  const start = partsOf(startDate);
  const end = partsOf(endDate);
  if (start.year !== end.year) {
    return `${dayMonth(startDate)} ${start.year}–${dayMonth(endDate)} ${end.year}`;
  }
  return start.month === end.month
    ? `${start.day}–${dayMonth(endDate)}`
    : `${dayMonth(startDate)}–${dayMonth(endDate)}`;
}

const OFF: PromoStatus = { kind: "off", line: "OFF" };

/** Pure: the banner's status at `now`, in Manila time. */
export function promoStatus(banner: PromoBanner | null, now: Date): PromoStatus {
  // Dates that aren't real, or that end before they start, never show: the
  // banner can't have ended by itself.
  if (
    !banner?.visible ||
    !isCalendarDate(banner.startDate) ||
    !isCalendarDate(banner.endDate) ||
    banner.endDate < banner.startDate
  ) {
    return OFF;
  }
  const { startDate, endDate } = banner;
  if (isPromoActive(banner, now)) {
    return { kind: "on", line: `ON · SHOWS ${span(startDate, endDate).toUpperCase()}` };
  }
  return now < manilaDayStart(startDate)
    ? { kind: "scheduled", line: `SCHEDULED · STARTS ${dayMonth(startDate).toUpperCase()}` }
    : { kind: "ended", line: `ENDED · TURNED OFF BY ITSELF ${dayMonth(endDate).toUpperCase()}` };
}
