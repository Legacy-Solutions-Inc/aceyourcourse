import { isPassActive } from "@/lib/member-app/access";

// ─────────────────────────────────────────────────────────────────────────────
// The Access Pass rule (CONTEXT.md → Access Pass; ADR 0010; spec, Phase 3 →
// Grants and ending access), pure. An Owner's grant or extension adds whole
// days to the pass from its current end, or from now when it has ended or
// there is none, so days are never lost and never counted twice. "End access
// now" sets the end to now: the access decision (access.ts) then answers
// "expired", and every progress record stays.
//
// From Phase 4 a pass can hold paid days as well as granted ones, and "End
// access now" may end only the granted days (refunds handle paid ones). Each
// grant's days are already kept as their own history row for that.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** The days "Grant Access Pass" offers; any other whole number up to GRANT_MAX_DAYS is a custom grant. */
export const GRANT_DAYS = [30, 90, 180, 365] as const;
/** The most days one grant gives. */
export const GRANT_MAX_DAYS = 365;
/** The days "Extend access" offers, and the only ones it gives. */
export const EXTEND_DAYS = [3, 7, 14, 30] as const;

/** The days one grant adds: from `startsAt` (ISO) to `endsAt`, the pass's new end. */
export interface PassDays {
  startsAt: string;
  endsAt: string;
}

/**
 * Pure: the days a grant of `days` adds to a pass that ends at `currentEnd`
 * (null for no pass), at `now`: from its end while it's active, otherwise from
 * now. Days are 24 hours each, so the time of day is kept.
 */
export function passWithDays(currentEnd: string | null, days: number, now: Date): PassDays {
  const start =
    currentEnd !== null && isPassActive(currentEnd, now) ? new Date(currentEnd) : new Date(now);
  return {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + days * DAY_MS).toISOString(),
  };
}

/**
 * Pure: the new end of a pass that ends at `currentEnd` once it's ended at
 * `now`, which is now; or null when it has already ended, so there's nothing
 * to end.
 */
export const endedNow = (currentEnd: string, now: Date): string | null =>
  isPassActive(currentEnd, now) ? now.toISOString() : null;
