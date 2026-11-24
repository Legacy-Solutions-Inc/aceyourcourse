import { isPastExamDate, resolveExamDate } from "@/lib/member-app/exam-date";
import { isCalendarDate } from "@/lib/manila-time";
import type { Plan } from "@/services/admin.types";
import { examCodesOnWebsite } from "@/services/catalogue.rules";
import type { Exam, ExamPage, Product } from "@/services/catalogue.types";
import { memberUserIdSchema } from "@/services/member.schema";
import type { AccessPass } from "@/services/content.types";
import type {
  AddedTargetExam,
  NewTargetExam,
  PickableExam,
  PlansExam,
  TargetExam,
  TargetExamRefusal,
  TargetExamResult,
} from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Member seam's Target Exam rules (spec, Phase 3 → Target Exams and the
// 2026-11-17 Target Exams decisions), shared by both arms, like the Catalogue
// seam's (catalogue.rules.ts). Each arm only says where a Member's records
// are held, the sample store (member.mock.ts) or Postgres (member.db.ts), so
// the two can't disagree on a rule.
// ─────────────────────────────────────────────────────────────────────────────

/** An Exam as the Member App needs it. */
export interface MemberExam extends PickableExam {
  /** Whether the Exam is on the Website: only those can be picked. */
  onWebsite: boolean;
}

/** A Target Exam as it's stored. A removed one is kept, so adding it back restores it. */
export interface TargetExamRecord {
  examCode: string;
  /** The Member's own date (YYYY-MM-DD). Null follows the Exam's Official Exam Date. */
  memberExamDate: string | null;
  /** ISO time the Member first added it. */
  addedAt: string;
  /** ISO time the Member removed it. Null while it's one of their Target Exams. */
  removedAt: string | null;
}

/** One Member's Target Exams as stored, with the Exams they refer to. */
export interface MemberExams {
  /** Every record, removed ones too, in the order first added. */
  records: TargetExamRecord[];
  /** The Exam the Member last selected, if any. */
  selectedExamCode: string | null;
  exams: MemberExam[];
}

/** What a change writes: one record, added or replaced by its Exam, and the selection. */
export interface TargetExamChange {
  record?: TargetExamRecord;
  selectedExamCode?: string | null;
}

/**
 * Runs `work` on one Member's Target Exams as they are now, then writes the
 * change it gives, all as one step: two changes to the same Member never
 * interleave. Throws for a User with no Member record.
 */
export type WithMemberExams = <T>(
  userId: string,
  work: (state: MemberExams) => { change: TargetExamChange | null; result: T },
) => Promise<T>;

/** The parts of the catalogue the Member App's Exams are read from. */
export interface ExamsCatalogue {
  /** In the catalogue's order. */
  exams: readonly Pick<Exam, "code" | "board" | "name">[];
  products: readonly Pick<Product, "examCode" | "showOnWebsite">[];
  examPages: readonly Pick<ExamPage, "examCode" | "officialExamDate">[];
}

/** Pure: every Exam as the Member App needs it, in the catalogue's order. */
export function examsForMembers({ exams, products, examPages }: ExamsCatalogue): MemberExam[] {
  const onWebsite = examCodesOnWebsite(products);
  return exams.map((exam) => ({
    code: exam.code,
    board: exam.board,
    name: exam.name,
    officialExamDate:
      examPages.find((page) => page.examCode === exam.code)?.officialExamDate ?? null,
    onWebsite: onWebsite.has(exam.code),
  }));
}

/** Pure: the Exams a Member can pick, which are the ones on the Website. */
export function pickableExams(exams: readonly MemberExam[]): PickableExam[] {
  return exams.filter((exam) => exam.onWebsite).map(({ onWebsite: _onWebsite, ...exam }) => exam);
}

/** Pure: an Exam code as a Member sent it, as the catalogue holds it: "ce " → "CE". */
export const examCodeOf = (code: string) => code.trim().toUpperCase();

/** The Member's Target Exams that aren't removed and whose Exam still exists, in the order added. */
function active(state: MemberExams): { record: TargetExamRecord; exam: MemberExam }[] {
  return state.records.flatMap((record) => {
    const exam = state.exams.find((e) => e.code === record.examCode);
    return exam && record.removedAt === null ? [{ record, exam }] : [];
  });
}

/**
 * Pure: a Member's Target Exams as the Member App shows them, in the order
 * added. The selected one is the one they last selected, or, when that's gone,
 * the first.
 */
export function targetExams(state: MemberExams): TargetExam[] {
  const list = active(state);
  const selected =
    list.find(({ exam }) => exam.code === state.selectedExamCode)?.exam.code ?? list[0]?.exam.code;
  return list.map(({ record, exam }) => {
    const resolved = resolveExamDate({
      memberDate: record.memberExamDate,
      officialDate: exam.officialExamDate,
    });
    return {
      examCode: exam.code,
      board: exam.board,
      name: exam.name,
      examDate: resolved?.date ?? null,
      dateSetBy: resolved?.setBy ?? null,
      selected: exam.code === selected,
      addedAt: record.addedAt,
    };
  });
}

/** Pure: the Member's Target Exams once a change is written. */
export function applyChange(state: MemberExams, change: TargetExamChange): MemberExams {
  const { record } = change;
  const exists = record && state.records.some((r) => r.examCode === record.examCode);
  const records = !record
    ? state.records
    : exists
      ? state.records.map((r) => (r.examCode === record.examCode ? record : r))
      : [...state.records, record];
  return {
    ...state,
    records,
    selectedExamCode:
      change.selectedExamCode === undefined ? state.selectedExamCode : change.selectedExamCode,
  };
}

type Planned<T> =
  | { ok: false; error: TargetExamRefusal }
  | { ok: true; change: TargetExamChange; value: (after: MemberExams) => T };

const refuse = (error: TargetExamRefusal) => ({ ok: false, error }) as const;

/** The Target Exam for `code` after a change. It's there: the change just put it there. */
function targetExamAfter(after: MemberExams, code: string): TargetExam {
  const found = targetExams(after).find((exam) => exam.examCode === code);
  if (!found) throw new Error(`The Target Exam ${code} wasn't found after its change.`);
  return found;
}

/** A date a Member typed: a real one that hasn't passed, or why not. Blank is null. */
function ownDate(
  examDate: string | null,
  now: Date,
): { ok: true; date: string | null } | { ok: false; error: TargetExamRefusal } {
  const date = examDate?.trim() || null;
  if (date === null) return { ok: true, date };
  if (!isCalendarDate(date)) return refuse("invalid-date");
  if (isPastExamDate(date, now)) return refuse("date-in-past");
  return { ok: true, date };
}

function planAdd(state: MemberExams, input: NewTargetExam, now: Date): Planned<AddedTargetExam> {
  const exam = state.exams.find((e) => e.code === examCodeOf(input.examCode));
  if (!exam?.onWebsite) return refuse("not-an-exam");
  const existing = state.records.find((record) => record.examCode === exam.code);
  if (existing && existing.removedAt === null) return refuse("already-yours");

  // A removed one comes back with its own date; the date sent matters only
  // when it would otherwise have none.
  const restoredWithDate =
    existing && (existing.memberExamDate !== null || exam.officialExamDate !== null);
  let memberExamDate = existing?.memberExamDate ?? null;
  if (!restoredWithDate) {
    // Keeping the prefilled Official Exam Date isn't setting one's own.
    const sent = input.examDate?.trim() || null;
    const given =
      sent === exam.officialExamDate ? { ok: true as const, date: null } : ownDate(sent, now);
    if (!given.ok) return given;
    if (given.date === null && exam.officialExamDate === null) return refuse("date-required");
    memberExamDate = given.date;
  }

  const record: TargetExamRecord = existing
    ? { ...existing, memberExamDate, removedAt: null }
    : { examCode: exam.code, memberExamDate, addedAt: now.toISOString(), removedAt: null };
  return {
    ok: true,
    change: { record, selectedExamCode: exam.code },
    value: (after) => ({
      targetExam: targetExamAfter(after, exam.code),
      restored: existing !== undefined,
    }),
  };
}

/**
 * Pure: what an Owner's grant for `examCode` does to a Member's Target Exams
 * (spec, Phase 3 planning decisions → Target Exams; story 133h), at `now`:
 * adds the Exam when they never had it, following its Official Exam Date;
 * brings back one they removed, as re-adding it would (planAdd): with their
 * own date if they had set one, otherwise following the Official Exam Date,
 * and with its progress, which is never deleted; or nothing when it's theirs
 * now. Their selection stays as it is. Any Exam in
 * the catalogue can be granted, on the Website or not, so this doesn't ask.
 */
export function grantedTargetExam(
  records: readonly TargetExamRecord[],
  examCode: string,
  now: Date,
): { record: TargetExamRecord; change: "added" | "restored" } | null {
  const existing = records.find((record) => record.examCode === examCode);
  if (!existing) {
    return {
      record: { examCode, memberExamDate: null, addedAt: now.toISOString(), removedAt: null },
      change: "added",
    };
  }
  if (existing.removedAt === null) return null;
  return { record: { ...existing, removedAt: null }, change: "restored" };
}

/** The Member's own Target Exam for `code`, when it's one of theirs now. */
const ownActive = (state: MemberExams, code: string) =>
  active(state).find(({ exam }) => exam.code === examCodeOf(code));

function planSetDate(
  state: MemberExams,
  code: string,
  examDate: string,
  now: Date,
): Planned<TargetExam> {
  const own = ownActive(state, code);
  if (!own) return refuse("not-yours");
  const unchanged =
    own.record.memberExamDate === null && examDate.trim() === own.exam.officialExamDate;
  const given = unchanged ? { ok: true as const, date: examDate.trim() } : ownDate(examDate, now);
  if (!given.ok) return given;
  if (given.date === null) return refuse("date-required");
  // Saving the Official Exam Date they already follow isn't setting their own.
  return {
    ok: true,
    change: { record: { ...own.record, memberExamDate: unchanged ? null : given.date } },
    value: (after) => targetExamAfter(after, own.exam.code),
  };
}

function planSelect(state: MemberExams, code: string): Planned<TargetExam> {
  const own = ownActive(state, code);
  if (!own) return refuse("not-yours");
  return {
    ok: true,
    change: { selectedExamCode: own.exam.code },
    value: (after) => targetExamAfter(after, own.exam.code),
  };
}

function planRemove(state: MemberExams, code: string, now: Date): Planned<TargetExam> {
  const own = ownActive(state, code);
  if (!own) return refuse("not-yours");
  const before = targetExams(state);
  if (before.length <= 1) return refuse("last-one");
  const removed = before.find((exam) => exam.examCode === own.exam.code);
  if (!removed) return refuse("not-yours");
  // The selection falls back to the first one remaining, by the order added.
  const fallback = before.find((exam) => exam.examCode !== removed.examCode)?.examCode ?? null;
  return {
    ok: true,
    change: {
      record: { ...own.record, removedAt: now.toISOString() },
      ...(removed.selected ? { selectedExamCode: fallback } : {}),
    },
    value: () => removed,
  };
}

/**
 * The Member seam's Target Exam operations over wherever an arm holds them.
 * Every one is scoped to the User id it's given, which the seam's caller takes
 * from the session: a Member only ever reads or changes their own.
 */
export function targetExamOperations(withMemberExams: WithMemberExams) {
  async function run<T>(
    userId: string,
    plan: (state: MemberExams) => Planned<T>,
  ): Promise<TargetExamResult<T>> {
    return withMemberExams<TargetExamResult<T>>(memberUserIdSchema.parse(userId), (state) => {
      const planned = plan(state);
      if (!planned.ok) return { change: null, result: planned };
      const value = planned.value(applyChange(state, planned.change));
      return { change: planned.change, result: { ok: true, value } };
    });
  }

  return {
    addTargetExam: (userId: string, input: NewTargetExam) =>
      run(userId, (state) => planAdd(state, input, new Date())),
    setExamDate: (userId: string, examCode: string, examDate: string) =>
      run(userId, (state) => planSetDate(state, examCode, examDate, new Date())),
    selectTargetExam: (userId: string, examCode: string) =>
      run(userId, (state) => planSelect(state, examCode)),
    removeTargetExam: (userId: string, examCode: string) =>
      run(userId, (state) => planRemove(state, examCode, new Date())),
  };
}

// ── Plans (Phase 4, ticket 02; spec, Phase 4 planning decisions → Who buys,
// and which Exams) ───────────────────────────────────────────────────────────

/** What the Plans page reads, gathered by each arm: the Exams, every Plan, and one Member's own records. */
export interface PlansInputs {
  exams: readonly MemberExam[];
  plans: readonly Plan[];
  /** The Member's own Target Exams. */
  targetExams: readonly TargetExam[];
  /** The Member's own Access Passes, ended ones too. */
  passes: readonly AccessPass[];
}

/** An Exam's Plans on sale, shortest first. */
const plansOnSale = (plans: readonly Plan[], examCode: string) =>
  plans.filter((plan) => plan.onSale && plan.examCode === examCode).sort((a, b) => a.days - b.days);

/** The Exams a Member can study (those on the Website) that have at least one Plan on sale, in order. */
const examsWithPlansOnSale = (exams: readonly MemberExam[], plans: readonly Plan[]) =>
  exams.filter((exam) => exam.onWebsite && plansOnSale(plans, exam.code).length > 0);

/**
 * Pure: the Plans page's Exams for one Member: each Exam on the Website with
 * a Plan on sale, in the catalogue's order, with its Plans on sale shortest
 * first, when the Member's pass for it ends, and the Exam Date a Plan would
 * count towards (their own for a Target Exam, otherwise the Official Exam
 * Date, which buying adds it with). An Exam that isn't on the Website has no
 * Plans page: no Member can pick it.
 */
export function plansExams({ exams, plans, targetExams, passes }: PlansInputs): PlansExam[] {
  return examsWithPlansOnSale(exams, plans).map((exam) => ({
    examCode: exam.code,
    board: exam.board,
    name: exam.name,
    plans: plansOnSale(plans, exam.code).map(({ id, name, days, priceCentavos, bestValue }) => ({
      id,
      name,
      days,
      priceCentavos,
      bestValue,
    })),
    passEndsAt: passes.find((pass) => pass.examCode === exam.code)?.endsAt ?? null,
    examDate:
      targetExams.find((target) => target.examCode === exam.code)?.examDate ??
      exam.officialExamDate,
  }));
}

/** Pure: the codes of the Exams on the Website with a Plan on sale, in order: where "See plans" leads. */
export const examCodesOnSale = (exams: readonly MemberExam[], plans: readonly Plan[]): string[] =>
  examsWithPlansOnSale(exams, plans).map((exam) => exam.code);
