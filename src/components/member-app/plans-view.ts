import { passWithDays } from "@/lib/member-app/access-pass";
import { isPastExamDate } from "@/lib/member-app/exam-date";
import { formatDate, manilaDate } from "@/lib/manila-time";
import { formatPeso } from "@/lib/money";
import { perMonthText, periodLabel } from "@/lib/plans/plan-text";
import type { PlansExam, TargetExam } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Member's Plans page, ordered and worded (Phase 4, ticket 02; spec,
// Phase 4 planning decisions → Who buys, and which Exams, Renewal reminders;
// stories 134 and 151c; BUILD-MAP §3 Plans). All pure: the page passes the
// Member seam's Plans read (listMemberPlans) and the time.
//
// A Plan row's end is the one the Member would get by buying it now:
// max(current end, now) + the Plan's days, the same arithmetic a grant uses
// (src/lib/member-app/access-pass.ts), shown as a Manila date. It "covers
// your exam" when it ends on or after the Exam Date, in Manila.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure: the pills' order: the Member's Target Exams first, in the order they
 * added them, then every other Exam in the catalogue's order. Only Exams with
 * a Plan on sale are given, so one with nothing on sale has no pill.
 */
export function orderPlansExams(
  exams: readonly PlansExam[],
  targetExams: readonly Pick<TargetExam, "examCode">[],
): PlansExam[] {
  const theirs = targetExams.flatMap(
    ({ examCode }) => exams.find((exam) => exam.examCode === examCode) ?? [],
  );
  return [...theirs, ...exams.filter((exam) => !theirs.includes(exam))];
}

/** Longer than any Exam code: anything past it isn't one. */
const MAX_CODE = 20;

/** Pure: the Exam an address's `?exam=` asks for, as an Exam code ("ce" → "CE"), or null for none. */
export function askedExam(raw: string | string[] | undefined): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  return value && value.length <= MAX_CODE ? value.toUpperCase() : null;
}

/**
 * Pure: the Exam the page opens on: the one the address asks for when it has
 * a Plan on sale; otherwise the Member's current Exam, when it has one;
 * otherwise the first pill. Null when nothing is on sale.
 */
export function openPlansExam(
  exams: readonly PlansExam[],
  asked: string | null,
  currentExamCode: string,
): PlansExam | null {
  const find = (code: string | null) => exams.find((exam) => exam.examCode === code);
  return find(asked) ?? find(currentExamCode) ?? exams[0] ?? null;
}

/** Pure: the line above an Exam's Plans, "CE ALL-ACCESS · FLASHCARDS, QUIZZES, REVIEWERS". */
export const plansHeading = (examCode: string) =>
  `${examCode} ALL-ACCESS · FLASHCARDS, QUIZZES, REVIEWERS`;

/** One Plan row, and the order summary when it's picked. */
export interface PlanRowView {
  id: string;
  /** "3 months". */
  period: string;
  /** "₱1,299". */
  price: string;
  /** "₱433 / month", or "for 30 days". */
  perMonth: string;
  bestValue: boolean;
  /** The Manila date access would end if bought now, "15 Feb 2027". */
  until: string;
  /** The Exam Date it reaches, "10 Feb 2027", or null when it ends before it, or there's none. */
  coversExamOn: string | null;
  /** The order summary's item, "CE All-Access · 3 months". */
  summary: string;
  /** The order summary's end, "UNTIL 15 FEB 2027 · NO AUTO-RENEWAL". */
  summaryUntil: string;
}

/**
 * Pure: an Exam's Plan rows at `now`, shortest first: each with the end the
 * Member would get (counting the days left on an active pass), and the Exam
 * Date when the end reaches it. An Exam Date already past isn't covered by
 * anything: Account asks the Member to update it.
 */
export function planRows(exam: PlansExam, now: Date): PlanRowView[] {
  const examDate =
    exam.examDate !== null && !isPastExamDate(exam.examDate, now) ? exam.examDate : null;
  return exam.plans.map((plan) => {
    const { endsAt } = passWithDays(exam.passEndsAt, plan.days, now);
    const until = formatDate(endsAt);
    const period = periodLabel(plan.days);
    return {
      id: plan.id,
      period,
      price: formatPeso(plan.priceCentavos),
      perMonth: perMonthText(plan.priceCentavos, plan.days),
      bestValue: plan.bestValue,
      until,
      coversExamOn:
        examDate !== null && manilaDate(new Date(endsAt)) >= examDate ? formatDate(examDate) : null,
      summary: `${plan.name} · ${period}`,
      summaryUntil: `UNTIL ${until.toUpperCase()} · NO AUTO-RENEWAL`,
    };
  });
}

/** Pure: the row the page opens with picked: the Best value Plan, else the shortest; null with none. */
export const defaultPlanId = (rows: readonly PlanRowView[]): string | null =>
  (rows.find((row) => row.bestValue) ?? rows[0])?.id ?? null;
