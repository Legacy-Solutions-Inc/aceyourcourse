import { paths } from "@/paths";
import type { Invite } from "@/services/admin.types";

// "Copy invite message" (spec, Phase 2 → Invites). No email is sent: the Owner
// pastes this text into their own email or chat. The Invite is the
// permission, so the message only says where to go and which Google account
// to sign in with, before when.

// en-US for three-letter months ("Sep"); en-GB says "Sept".
const expiryParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "Sat, 7 Nov 2026": the Manila day the Invite expires. */
function expiryDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) throw new RangeError(`Expected an ISO date, got "${iso}"`);
  const part = Object.fromEntries(expiryParts.formatToParts(at).map((p) => [p.type, p.value]));
  return `${part.weekday}, ${part.day} ${part.month} ${part.year}`;
}

const ROLE_NAMES = { owner: "Owner", editor: "Editor" } as const;

/**
 * Pure: the ready-to-send invite message, naming the Staff Role, the Admin
 * address on `siteUrl`, the Google email and the Manila day the Invite
 * expires. Throws a RangeError for an expiry that isn't a date.
 */
export function inviteMessage({
  role,
  email,
  expiresAt,
  siteUrl,
}: Pick<Invite, "role" | "email" | "expiresAt"> & { siteUrl: string }): string {
  const admin = new URL(paths.admin.overview, siteUrl).toString();
  return (
    `Hi! You've been added to the Ace Your Course Admin as an ${ROLE_NAMES[role]}. ` +
    `Open ${admin}, choose “Continue with Google” and sign in as ${email}. ` +
    `Please sign in by ${expiryDay(expiresAt)}, when the invite expires.`
  );
}

/**
 * Copies the text, answering whether it worked. The clipboard API can be
 * missing (an insecure origin) or refused (permissions), and then it's false.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
