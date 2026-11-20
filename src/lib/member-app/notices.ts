import { passEndDate } from "@/lib/member-app/access";
import type { MemberNotice } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App's in-app notices (spec, Phase 3 planning decisions → In-app
// notices; stories 131, 133h and 133j), pure. An Owner's grant, extension or
// end of a Member's Access Pass leaves a notice, which the Member App shows
// as one dismissible banner until the Member dismisses it. There's no email
// and no notification centre.
//
// Every notice shows until the Member dismisses it, newest first, so a grant
// followed by "End access now" shows both, the end on top.
// ─────────────────────────────────────────────────────────────────────────────

/** Pure: what a notice's banner says, with the pass's end as a Manila date. */
export function noticeText({ kind, examCode, endsAt }: MemberNotice): string {
  switch (kind) {
    case "granted":
      return `You now have ${examCode} All-Access until ${passEndDate(endsAt)}`;
    case "extended":
      return `Your ${examCode} access was extended to ${passEndDate(endsAt)}`;
    case "ended":
      return `Your ${examCode} access has ended`;
  }
}

/**
 * Pure: the notices the Member App shows, from a Member's notices in the
 * order they were made: each one they haven't dismissed, newest first.
 */
export const noticesToShow = (notices: readonly MemberNotice[]): MemberNotice[] =>
  notices.filter(({ dismissedAt }) => dismissedAt === null).reverse();
