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

/** Pure: the calendar year in Manila at the given instant. */
export function manilaYear(now: Date): number {
  return Number(yearOnly.format(now));
}
