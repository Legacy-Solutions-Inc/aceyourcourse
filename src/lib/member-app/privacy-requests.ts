import { addCalendarDays, manilaDate } from "@/lib/manila-time";

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Requests (spec, Phase 3 → Privacy Requests; Privacy Policy §14),
// pure. A Member asks from Account for a copy of their data or for their
// account to be deleted; Owners carry each one out by hand (ticket 19). A data
// copy is due within 7 days and a deletion within 30, counted in Asia/Manila
// calendar days from the day the Member asked, so a request is overdue from
// Manila midnight after its due date. A Member has at most one open request of
// each type.
// ─────────────────────────────────────────────────────────────────────────────

export const PRIVACY_REQUEST_TYPES = ["data-copy", "deletion"] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

/** Open until an Owner marks it done (ticket 19). */
export const PRIVACY_REQUEST_STATUSES = ["open", "done"] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

/** How many days AYC has to carry out each type of request. */
export const PRIVACY_REQUEST_DAYS: Readonly<Record<PrivacyRequestType, number>> = {
  "data-copy": 7,
  deletion: 30,
};

/** What a Member types to confirm they want their account deleted. */
export const DELETION_CONFIRMATION = "DELETE";

/**
 * Pure: the Manila date (YYYY-MM-DD) a request of `type` made at
 * `requestedAt` is due: its days after the Manila day it was made.
 */
export const privacyRequestDueOn = (type: PrivacyRequestType, requestedAt: Date): string =>
  addCalendarDays(manilaDate(requestedAt), PRIVACY_REQUEST_DAYS[type]);

/** Pure: whether a request is still open after its due date, in Manila, at `now`. */
export const isPrivacyRequestOverdue = (
  { status, dueOn }: { status: PrivacyRequestStatus; dueOn: string },
  now: Date,
): boolean => status === "open" && manilaDate(now) > dueOn;

/** Pure: whether what the Member typed is the deletion confirmation, ignoring spaces around it. */
export const isDeletionConfirmed = (typed: string): boolean =>
  typed.trim() === DELETION_CONFIRMATION;
