import { formatCount } from "@/lib/catalogue/figures";
import { formatDate } from "@/lib/manila-time";
import { isPassActive, passEndDate } from "@/lib/member-app/access";
import type { MemberProgress } from "@/lib/member-app/progress";
import type { AccessPassChange, AdminUserList, UserFilter, UserRole } from "@/services/admin.types";

import { USERS_PAGE_SIZE } from "./users-list";

// How the Users list and a Member's detail page word a Member (BUILD-MAP
// §3.10; stories 129, 130). Pure. Every date is the day in Asia/Manila, as
// the Member App words a pass's end (passEndDate).

/** The list's filter chips. */
export const USER_FILTER_LABELS: Record<UserFilter, string> = {
  all: "All",
  active: "Active Pass",
  expired: "Expired",
  none: "None",
  staff: "Staff",
  beta: "Beta Tester",
};

/** Pure: when an Access Pass ends, as its day in Manila, and whether it has ended at `now`. */
export function passEnd(endsAt: string, now: Date): { date: string; expired: boolean } {
  return {
    date: passEndDate(endsAt).toUpperCase(),
    expired: !isPassActive(endsAt, now),
  };
}

/** Which change the ACCESS PASSES panel words: an end of granted days that kept paid ones is "end-granted" (ticket 10). */
export type ChangeWording = "grant" | "extend" | "end" | "end-granted";

/** Pure: what the ACCESS PASSES panel says once a grant, an extension or an end is done. */
export function passChangeText(
  action: ChangeWording,
  { examCode, endsAt, days, targetExam }: AccessPassChange,
): string {
  const until = passEndDate(endsAt).toUpperCase();
  switch (action) {
    case "grant": {
      const added =
        targetExam === "added"
          ? " · ADDED TO THEIR TARGET EXAMS"
          : targetExam === "restored"
            ? " · BACK IN THEIR TARGET EXAMS"
            : "";
      return `✓ GRANTED ${examCode} UNTIL ${until} · NO PAYMENT COLLECTED${added}`;
    }
    case "extend":
      return `✓ ADDED ${days ?? 0} DAYS · ${examCode} UNTIL ${until}`;
    case "end":
      return `✓ ENDED ${examCode} ACCESS · THEY SEE THE EXPIRED STATE`;
    case "end-granted":
      return `✓ ENDED ${examCode} GRANTED DAYS · ACCESS UNTIL ${until}`;
  }
}

/** Pure: the ROLE column. */
export const roleLabel = (role: UserRole) => role.toUpperCase();

/** Pure: the avatar's letters: the first two words of the name, or the email's first letter. */
export function memberInitials(name: string | null, email: string): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const letters = words.length > 0 ? words.slice(0, 2).map((word) => word[0]) : [email[0]];
  return letters.join("").toUpperCase();
}

const plural = (n: number, one: string, many: string) =>
  `${formatCount(n)} ${n === 1 ? one : many}`;

/** Pure: the list's footer, "26–30 OF 30 MEMBERS": the Members this page shows, of those matching. */
export function pageSummary({
  query,
  rows,
  matching,
}: {
  query: Pick<AdminUserList["query"], "page">;
  rows: number;
  matching: number;
}): string {
  const total = plural(matching, "MEMBER", "MEMBERS");
  if (rows === 0) return total;
  const from = (query.page - 1) * USERS_PAGE_SIZE + 1;
  const to = from + rows - 1;
  const range = from === to ? formatCount(from) : `${formatCount(from)}–${formatCount(to)}`;
  return `${range} OF ${total}`;
}

/** What a Member's progress in one Exam says on their detail page. */
export interface ProgressFigures {
  cards: string;
  quizAverage: string;
  quizzes: string;
  pages: string;
  lastActive: string;
  streak: string;
}

/** Pure: a Member's progress in one Exam as the detail page shows it (ticket 15's figures). */
export function progressFigures({
  cards,
  pages,
  quizAverage,
  quizzesTaken,
  streak,
}: MemberProgress): ProgressFigures {
  const outOf = (part: number, total: number) =>
    total > 0 ? `${formatCount(part)} / ${formatCount(total)}` : "—";
  return {
    cards: outOf(cards.got, cards.total),
    quizAverage: quizAverage === null ? "—" : `${quizAverage}%`,
    quizzes:
      quizzesTaken === 0 ? "NO QUIZ TAKEN" : `${plural(quizzesTaken, "QUIZ", "QUIZZES")} TAKEN`,
    pages: outOf(pages.viewed, pages.total),
    lastActive: streak.lastStudyDay ? formatDate(streak.lastStudyDay) : "Never",
    streak:
      streak.best === 0
        ? "NO STREAK YET"
        : `${plural(streak.current, "DAY", "DAYS")} · BEST ${formatCount(streak.best)}`,
  };
}
