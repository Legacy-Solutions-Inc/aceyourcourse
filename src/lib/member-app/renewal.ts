import { manilaDate } from "@/lib/manila-time";
import { isPassActive } from "@/lib/member-app/access";
import type { UnlockRoute } from "@/lib/member-app/unlock";

// ─────────────────────────────────────────────────────────────────────────────
// The renewal reminders (Phase 4, ticket 12; spec, Phase 4 → Renewal nudges,
// Phase 4 planning decisions → Renewal reminders; stories 141 and 142), pure.
// In the week before an Access Pass (paid or granted) ends, the Member App
// shows one banner per Exam on Home and on that Exam's study screens, framed
// around the Exam Date:
//   - "within 7 days" is in Manila calendar days: a pass ending on the 7th
//     Manila day from today shows, one ending on the 8th doesn't, and one
//     that has already ended never does (the ended state takes over);
//   - ending before the Exam Date, it counts the Manila days between the two;
//     on or after it, or with no Exam Date, it gives the end alone;
//   - dismissing hides that Exam's banner for the rest of the Manila day;
//   - Staff never see one.
// No email is sent: that waits for a sending domain.
// ─────────────────────────────────────────────────────────────────────────────

/** How many Manila days before a pass ends its reminder starts. */
export const RENEWAL_WINDOW_DAYS = 7;

export interface RenewalInputs {
  /** The Member's Access Passes, at most one per Exam, ended ones too. */
  passes: readonly { examCode: string; endsAt: string }[];
  /** The Member's Target Exams, each with its Exam Date (YYYY-MM-DD) or null. */
  exams: readonly { examCode: string; examDate: string | null }[];
  /** The Manila days (YYYY-MM-DD) the Member dismissed each Exam's reminder. */
  dismissals: readonly RenewalDismissal[];
  /** On the staff list now, and active. */
  activeStaff: boolean;
  now: Date;
}

/** A Member's dismissal of one Exam's reminder, on one Manila day. */
export interface RenewalDismissal {
  examCode: string;
  /** YYYY-MM-DD, in Manila. */
  day: string;
}

/** One Exam's reminder: its pass ends within the window. */
export interface RenewalReminder {
  examCode: string;
  /** ISO time the pass ends. */
  endsAt: string;
  /** Manila days from the end to the Exam Date when it ends before it; null otherwise. */
  daysBeforeExam: number | null;
}

/** A reminder as the banner shows it: its Exam, for "Dismiss", and its words and link. */
export interface RenewalBannerView {
  examCode: string;
  text: string;
  /**
   * How to renew: from the Exam's Plans while it has one on sale, otherwise
   * by asking AYC (ticket 02's "contact us" note).
   */
  renew: { kind: "plans"; label: string; href: string } | { kind: "contact"; contactEmail: string };
}

const DAY = 24 * 60 * 60 * 1000;

/** Calendar days from one YYYY-MM-DD date to another. */
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/** Pure: the Manila day a dismissal made at `now` holds for. */
export const renewalDismissalDay = (now: Date): string => manilaDate(now);

/**
 * Pure: the reminders a Member sees now, soonest end first: one per Exam
 * whose pass ends within the next 7 Manila days and wasn't dismissed today.
 * None for Staff.
 */
export function renewalReminders({
  passes,
  exams,
  dismissals,
  activeStaff,
  now,
}: RenewalInputs): RenewalReminder[] {
  if (activeStaff) return [];
  const today = manilaDate(now);
  const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();
  const dismissedToday = (examCode: string) =>
    dismissals.some((dismissal) => same(dismissal.examCode, examCode) && dismissal.day === today);

  return passes
    .filter(({ endsAt }) => isPassActive(endsAt, now))
    .filter(({ endsAt }) => daysBetween(today, manilaDate(new Date(endsAt))) <= RENEWAL_WINDOW_DAYS)
    .filter(({ examCode }) => !dismissedToday(examCode))
    .map(({ examCode, endsAt }) => {
      const examDate = exams.find((exam) => same(exam.examCode, examCode))?.examDate ?? null;
      const gap = examDate === null ? 0 : daysBetween(manilaDate(new Date(endsAt)), examDate);
      return { examCode: examCode.toUpperCase(), endsAt, daysBeforeExam: gap > 0 ? gap : null };
    })
    .sort((a, b) => a.endsAt.localeCompare(b.endsAt) || a.examCode.localeCompare(b.examCode));
}

// en-GB for the day-first order ("25 Oct"). The end is at most 7 days off, so
// its year goes without saying.
const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Manila",
});

/**
 * Pure: a reminder's banner. Ending before the exam: "Your CE All-Access ends
 * 25 Oct, 27 days before your exam" and "Renew to cover your exam"; otherwise
 * "Your CE All-Access ends 25 Oct" and "Renew access". Both lead to that
 * Exam's Plans while it has one on sale (`unlock`), and to the "contact us"
 * note otherwise, as a lock does.
 */
export function renewalBanner(
  { examCode, endsAt, daysBeforeExam }: RenewalReminder,
  unlock: UnlockRoute,
): RenewalBannerView {
  const ends = `Your ${examCode} All-Access ends ${dayMonth.format(new Date(endsAt))}`;
  const text =
    daysBeforeExam === null
      ? ends
      : `${ends}, ${daysBeforeExam} ${daysBeforeExam === 1 ? "day" : "days"} before your exam`;
  const label = daysBeforeExam === null ? "Renew access" : "Renew to cover your exam";
  return {
    examCode,
    text,
    renew:
      unlock.kind === "plans"
        ? { kind: "plans", label, href: unlock.href }
        : { kind: "contact", contactEmail: unlock.contactEmail },
  };
}
