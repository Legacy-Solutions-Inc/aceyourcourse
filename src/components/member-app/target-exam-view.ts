import { countdownLabel, examCountdown, type ExamCountdown } from "@/lib/member-app/exam-date";
import { formatDate } from "@/lib/manila-time";
import type { TargetExam } from "@/services/member.types";

// How the shell and Account word a Target Exam (BUILD-MAP §2; spec, Phase 3 →
// Target Exams). Pure: the server passes the time, so the browser and the
// server never disagree on the day.

/** A Target Exam as the exam switcher shows it. */
export interface SwitcherExam {
  code: string;
  board: string;
  name: string;
  /** Under the name in the dropdown: "Exam 21 Nov 2026", or that there's no date. */
  meta: string;
  /** The card's last line: "4 days to the exam", "Exam day", and so on. */
  countdown: string;
  selected: boolean;
}

/** Pure: whose date it is, as Home and Account say it. */
export function dateSetByLabel(exam: Pick<TargetExam, "dateSetBy">): string | null {
  if (exam.dateSetBy === "member") return "Date set by you";
  if (exam.dateSetBy === "official") return "Official exam date";
  return null;
}

/** Pure: a Target Exam's Exam Date in words, such as "21 Nov 2026", or that it has none. */
export function examDateLabel(exam: Pick<TargetExam, "examDate">): string {
  return exam.examDate ? formatDate(exam.examDate) : "No exam date yet";
}

/** Pure: the Member's Target Exams as the exam switcher shows them at `now`. */
export function switcherExams(targetExams: readonly TargetExam[], now: Date): SwitcherExam[] {
  return targetExams.map((exam) => ({
    code: exam.examCode,
    board: exam.board,
    name: exam.name,
    meta: exam.examDate ? `Exam ${formatDate(exam.examDate)}` : examDateLabel(exam),
    countdown: countdownLabel(examCountdown(exam.examDate, now)),
    selected: exam.selected,
  }));
}

/** A Target Exam as Account's "Your exams" shows it. */
export interface YourExam {
  code: string;
  board: string;
  name: string;
  /** YYYY-MM-DD, or blank when it has none. */
  examDate: string;
  /** "21 Nov 2026", or that there's no date. */
  dateLabel: string;
  /** "Date set by you", "Official exam date", or null with no date. */
  setByLabel: string | null;
  /** "4 days to the exam", "Exam day", and so on. */
  countdown: string;
  selected: boolean;
}

/** Pure: the Member's Target Exams as Account's "Your exams" shows them at `now`. */
export function yourExams(targetExams: readonly TargetExam[], now: Date): YourExam[] {
  return targetExams.map((exam) => ({
    code: exam.examCode,
    board: exam.board,
    name: exam.name,
    examDate: exam.examDate ?? "",
    dateLabel: examDateLabel(exam),
    setByLabel: dateSetByLabel(exam),
    countdown: countdownLabel(examCountdown(exam.examDate, now)),
    selected: exam.selected,
  }));
}

/** What Home's countdown card shows, in big and in small. */
export interface CountdownWords {
  /** The big figure or phrase: "4", "Exam day", "Exam passed". */
  big: string;
  /** Beside or under it: "days to go", or what to do next. */
  small: string;
}

/** Pure: Home's countdown in words. */
export function countdownWords(countdown: ExamCountdown): CountdownWords {
  switch (countdown.kind) {
    case "days":
      return {
        big: String(countdown.days),
        small: countdown.days === 1 ? "day to go" : "days to go",
      };
    case "exam-day":
      return { big: "Exam day", small: "It’s today. Kaya mo ’to." };
    case "passed":
      return { big: "Exam passed", small: "Update your date in Account." };
    case "no-date":
      return { big: "No exam date yet", small: "Set one in Account." };
  }
}
