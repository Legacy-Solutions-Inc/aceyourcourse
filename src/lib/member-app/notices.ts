import { isPassActive, passEndDate } from "@/lib/member-app/access";
import type { MemberNotice } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App's in-app notices (spec, Phase 3 planning decisions → In-app
// notices; stories 131, 133h and 133j), pure. An Owner's grant, extension or
// end of a Member's Access Pass leaves a notice, which the Member App shows
// as one dismissible banner until the Member dismisses it. There's no email
// and no notification centre. A full refund in PayMongo leaves one too
// (Phase 4, ticket 09), naming the Order and the pass's end after it. An
// Owner's end that takes the granted days and leaves paid ones says the
// pass's new end (ticket 10). An Owner giving or removing a Course, and a
// full refund that takes a Course away, leave one naming the Course (Phase 5,
// ticket 07).
//
// Every notice shows until the Member dismisses it, newest first, so a grant
// followed by "End access now" shows both, the end on top.
// ─────────────────────────────────────────────────────────────────────────────

/** Pure: what a notice's banner says, with the pass's end as a Manila date. */
export function noticeText({
  kind,
  examCode,
  endsAt,
  createdAt,
  reference,
  courseTitle,
}: MemberNotice): string {
  const course = `the ${courseTitle ?? "Course"}`;
  switch (kind) {
    case "granted":
      return `You now have ${examCode} All-Access until ${passEndDate(endsAt)}`;
    case "extended":
      return `Your ${examCode} access was extended to ${passEndDate(endsAt)}`;
    case "ended":
      return `Your ${examCode} access has ended`;
    case "shortened":
      return `Your ${examCode} access now ends ${passEndDate(endsAt)}`;
    case "refunded": {
      // A refund that ended the pass ends it then: its end is the notice's making.
      const access = isPassActive(endsAt, new Date(createdAt))
        ? `now ends ${passEndDate(endsAt)}`
        : "has ended";
      return `Your refund for ${reference ?? "your Order"} was processed. ${examCode} All-Access ${access}`;
    }
    case "course-given":
      return `You now own ${course}`;
    case "course-removed":
      return `You no longer own ${course}`;
    case "course-refunded":
      return `Your refund for ${reference ?? "your Order"} was processed. You no longer own ${course}.`;
  }
}

/**
 * Pure: the notices the Member App shows, from a Member's notices in the
 * order they were made: each one they haven't dismissed, newest first.
 */
export const noticesToShow = (notices: readonly MemberNotice[]): MemberNotice[] =>
  notices.filter(({ dismissedAt }) => dismissedAt === null).reverse();
