/**
 * Asia/Manila time helpers. Every day boundary in Ace Your Course (Study Day,
 * countdowns, promo dates, "as of" labels, the footer year) is Manila time,
 * whatever the server's or the Visitor's own time zone is.
 */

const MANILA = "Asia/Manila";
/** Manila is UTC+8 all year: the Philippines has no daylight saving time. */
const MANILA_OFFSET = "+08:00";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const monthYear = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  year: "numeric",
  timeZone: MANILA,
});

const yearOnly = new Intl.DateTimeFormat("en-PH", { year: "numeric", timeZone: MANILA });

const isoParts = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: MANILA,
});

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

/**
 * Pure: whether a string is a YYYY-MM-DD date on the calendar. new Date() rolls
 * "2026-02-30" over to 2 March; this rejects it.
 */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Pure: the instant a Manila calendar day begins, "2026-11-09" →
 * 2026-11-08T16:00:00Z. Throws a RangeError for anything but a YYYY-MM-DD date
 * on the calendar.
 */
export function manilaDayStart(isoDate: string): Date {
  if (!isCalendarDate(isoDate)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${isoDate}"`);
  }
  return parseDate(`${isoDate}T00:00:00${MANILA_OFFSET}`);
}

/** Pure: the calendar date in Manila at the given instant, as YYYY-MM-DD. */
export function manilaDate(now: Date): string {
  const part = Object.fromEntries(isoParts.formatToParts(now).map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

/** Pure: the calendar year in Manila at the given instant. */
export function manilaYear(now: Date): number {
  return Number(yearOnly.format(now));
}
