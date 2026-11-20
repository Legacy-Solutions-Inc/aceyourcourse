import { manilaDate } from "@/lib/manila-time";

// A Target Exam's Exam Date and its countdown (spec, Phase 3 → Target Exams;
// stories 84–88). All pure: the caller passes the dates and the time.

/** Whose date a Target Exam's Exam Date is: the Member's own, or the Exam's Official Exam Date. */
export type ExamDateSetBy = "member" | "official";

export interface ResolvedExamDate {
  /** YYYY-MM-DD. */
  date: string;
  setBy: ExamDateSetBy;
}

/**
 * Pure: a Target Exam's Exam Date. The Member's own date once they have set
 * one; until then the Exam's Official Exam Date, read each time, so a Staff
 * change moves every Member who never edited theirs. Null when neither is set.
 */
export function resolveExamDate({
  memberDate,
  officialDate,
}: {
  memberDate: string | null;
  officialDate: string | null;
}): ResolvedExamDate | null {
  if (memberDate) return { date: memberDate, setBy: "member" };
  if (officialDate) return { date: officialDate, setBy: "official" };
  return null;
}

const DAY = 24 * 60 * 60 * 1000;

/** A calendar date as a day number, for subtracting dates. */
const dayNumber = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`) / DAY;

/** Pure: Asia/Manila calendar days from today to a YYYY-MM-DD date. Negative once it has passed. */
function manilaDaysUntil(isoDate: string, now: Date): number {
  return Math.round(dayNumber(isoDate) - dayNumber(manilaDate(now)));
}

/** What the countdown shows for an Exam Date. */
export type ExamCountdown =
  { kind: "days"; days: number } | { kind: "exam-day" } | { kind: "passed" } | { kind: "no-date" };

/**
 * Pure: the countdown to an Exam Date, in Asia/Manila calendar days from
 * today. On the day it's "exam-day", after it "passed", and "no-date" when the
 * Target Exam has no date (the Exam has no Official Exam Date and the Member
 * set none).
 */
export function examCountdown(examDate: string | null, now: Date): ExamCountdown {
  if (!examDate) return { kind: "no-date" };
  const days = manilaDaysUntil(examDate, now);
  if (days > 0) return { kind: "days", days };
  return days === 0 ? { kind: "exam-day" } : { kind: "passed" };
}

/** Pure: the countdown as one line, as the exam switcher shows it. */
export function countdownLabel(countdown: ExamCountdown): string {
  switch (countdown.kind) {
    case "days":
      return `${countdown.days} ${countdown.days === 1 ? "day" : "days"} to the exam`;
    case "exam-day":
      return "Exam day";
    case "passed":
      return "Exam passed. Update your date in Account.";
    case "no-date":
      return "No exam date yet. Set one in Account.";
  }
}

/** Pure: whether a YYYY-MM-DD date is before today in Asia/Manila. Today itself isn't past. */
export function isPastExamDate(isoDate: string, now: Date): boolean {
  return manilaDaysUntil(isoDate, now) < 0;
}
