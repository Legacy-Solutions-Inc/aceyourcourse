/**
 * Asia/Manila time helpers. Every day boundary in Ace Your Course (Study Day,
 * countdowns, promo dates, "as of" labels, the footer year) is Manila time,
 * whatever the server's or the Visitor's own time zone is.
 */

const MANILA = "Asia/Manila";

const monthYear = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  year: "numeric",
  timeZone: MANILA,
});

const yearOnly = new Intl.DateTimeFormat("en-PH", { year: "numeric", timeZone: MANILA });

// en-GB for the day-first order ("1 Dec 2026"); en-PH puts the month first.
const dayMonthYear = {
  short: new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: MANILA,
  }),
  long: new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: MANILA,
  }),
};

function parseDate(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Expected an ISO date, got "${iso}"`);
  }
  return date;
}

/** Pure: "2026-10-29" → "as of Oct 2026". Throws a RangeError for a non-date. */
export function formatAsOf(isoDate: string): string {
  return `as of ${monthYear.format(parseDate(isoDate))}`;
}

/**
 * Pure: "2026-12-01" → "1 Dec 2026", or "1 December 2026" with `month: "long"`.
 * Throws a RangeError for a non-date.
 */
export function formatDate(isoDate: string, month: "short" | "long" = "short"): string {
  return dayMonthYear[month].format(parseDate(isoDate));
}

/** Pure: the calendar year in Manila at the given instant. */
export function manilaYear(now: Date): number {
  return Number(yearOnly.format(now));
}
