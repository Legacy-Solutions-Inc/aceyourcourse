import { manilaDate } from "@/lib/manila-time";
import type { StaffList, StaffRole } from "@/services/admin.types";

// The ADMIN ACCOUNTS rows in Settings (mockup 694–699; BUILD-MAP §3.11, with
// CONVENTIONS §4's copy): who can use the Admin, as an Owner sees it.

const DAY = 24 * 60 * 60 * 1000;

const BADGES = { owner: "OWNER", editor: "EDITOR" } as const;

interface RowBase {
  email: string;
  name: string;
  role: StaffRole;
}

export type StaffRow =
  /** The signed-in Owner: no Remove or Change role, so nobody locks themselves out. */
  | (RowBase & { kind: "you" | "staff"; badge: "OWNER" | "EDITOR"; status: string })
  | (RowBase & { kind: "invite" | "expired"; badge: "INVITED"; status: string; expiresAt: string });

/** Pure: "TODAY", "YESTERDAY" or "N DAYS AGO", counted in Manila calendar days. */
function daysAgo(at: string, now: Date): string {
  const days = Math.round(
    (Date.parse(manilaDate(now)) - Date.parse(manilaDate(new Date(at)))) / DAY,
  );
  if (days <= 0) return "TODAY";
  if (days === 1) return "YESTERDAY";
  return `${days} DAYS AGO`;
}

/** Pure: "EXPIRES IN N DAYS", rounding a part day up, so a new Invite reads 7. */
function expiresIn(expiresAt: string, now: Date): string {
  const days = Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY);
  return `EXPIRES IN ${days} ${days === 1 ? "DAY" : "DAYS"}`;
}

/**
 * Pure: the rows for the staff list, as the Owner signed in as `you` sees it
 * at `now`: the active Staff, then the Invites, in the list's order.
 */
export function staffRows(list: StaffList, you: string, now: Date): StaffRow[] {
  const yours = you.trim().toLowerCase();
  return [
    ...list.staff.map(({ email, name, role, lastSignedInAt }): StaffRow => {
      const isYou = email === yours;
      return {
        kind: isYou ? "you" : "staff",
        email,
        name,
        role,
        badge: BADGES[role],
        status: isYou
          ? "YOU · CAN’T BE REMOVED"
          : lastSignedInAt
            ? `LAST SIGNED IN ${daysAgo(lastSignedInAt, now)}`
            : "NOT SIGNED IN YET",
      };
    }),
    ...list.invites.map(({ email, role, expiresAt }): StaffRow => {
      const expired = now.getTime() >= Date.parse(expiresAt);
      return {
        kind: expired ? "expired" : "invite",
        email,
        name: "Invited",
        role,
        badge: "INVITED",
        status: expired ? "EXPIRED" : expiresIn(expiresAt, now),
        expiresAt,
      };
    }),
  ];
}
