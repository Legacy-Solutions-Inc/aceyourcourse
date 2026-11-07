import { manilaDayStart } from "@/lib/manila-time";

/**
 * The Admin's Manila-time labels: the Overview greeting and date line, the 403
 * screen's "attempt was logged" time, and the save stamps' dates and times.
 * Manila is UTC+8 all year. See src/lib/manila-time.ts for the Website's date
 * helpers.
 */

// en-US for three-letter months ("Sep"); en-GB says "Sept".
const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function manilaParts(at: Date) {
  const values = Object.fromEntries(parts.formatToParts(at).map((part) => [part.type, part.value]));
  return {
    weekday: String(values.weekday),
    day: String(values.day),
    month: String(values.month),
    year: String(values.year),
    hour: Number(values.hour),
  };
}

/** "22 Oct 2026" in Manila. */
function dayMonthYear(at: Date): string {
  const { day, month, year } = manilaParts(at);
  return `${day} ${month} ${year}`;
}

/** "11:42 AM" in Manila. Some ICU versions put a narrow no-break space before AM/PM. */
const clockTime = (at: Date) => clock.format(at).replace(/\s/g, " ");

function parseInstant(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Expected an ISO date, got "${iso}"`);
  }
  return date;
}

/**
 * Pure: the Overview greeting, "Good morning, Angel.", by the hour in Manila:
 * morning before 12:00, afternoon before 18:00, then evening. It greets by the
 * first word of the Staff User's name, and leaves the name out when there is
 * none: a User with no profile name has their email address here.
 */
export function greeting(now: Date, name: string): string {
  const { hour } = manilaParts(now);
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const [firstName = ""] = name.trim().split(/\s+/);
  if (!firstName || firstName.includes("@")) return `Good ${partOfDay}.`;
  return `Good ${partOfDay}, ${firstName}.`;
}

/** Pure: the Overview's date line in Manila, "THURSDAY · 22 OCT 2026". */
export function overviewDateLine(now: Date): string {
  const { weekday, day, month, year } = manilaParts(now);
  return `${weekday} · ${day} ${month} ${year}`.toUpperCase();
}

/**
 * Pure: when a denied sign-in was recorded, in Manila, "22 OCT 2026, 11:42 AM".
 * Throws a RangeError for a non-date.
 */
export function formatLoggedAt(iso: string): string {
  const at = parseInstant(iso);
  return `${dayMonthYear(at).toUpperCase()}, ${clockTime(at)}`;
}

/** Pure: the Manila date of a save, for "LAST CHANGED 14 OCT 2026". Throws a RangeError for a non-date. */
export function formatChangedOn(iso: string): string {
  return dayMonthYear(parseInstant(iso)).toUpperCase();
}

/** Pure: a YYYY-MM-DD date, for "AS OF 29 OCT 2026". Throws a RangeError for a date not on the calendar. */
export function formatAsOfDate(isoDate: string): string {
  return dayMonthYear(manilaDayStart(isoDate)).toUpperCase();
}

/**
 * Pure: when a record was saved, for the conflict notice: "2:41 PM" for a save
 * made earlier the same Manila day as `now`, otherwise "2:41 PM on 21 Oct
 * 2026". Throws a RangeError for a non-date.
 */
export function formatSavedAt(iso: string, now: Date): string {
  const at = parseInstant(iso);
  const date = dayMonthYear(at);
  return date === dayMonthYear(now) ? clockTime(at) : `${clockTime(at)} on ${date}`;
}
