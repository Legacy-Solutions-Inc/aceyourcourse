import Link from "next/link";

import { examCountdown } from "@/lib/member-app/exam-date";
import { paths } from "@/paths";
import type { TargetExam } from "@/services/member.types";

import { countdownWords, dateSetByLabel, examDateLabel } from "./target-exam-view";

interface ExamCountdownProps {
  /** The Member's selected Target Exam. */
  exam: TargetExam;
  /** The time the page was made: days left count Asia/Manila calendar days from it. */
  now: Date;
}

/**
 * Home's countdown card (mockup L161–166; stories 84–88): the selected Target
 * Exam's board, the days left to its Exam Date, and whose date that is. On
 * the day it reads "Exam day"; after it, "Exam passed", pointing at Account.
 */
export function ExamCountdown({ exam, now }: ExamCountdownProps) {
  const countdown = examCountdown(exam.examDate, now);
  const { big, small } = countdownWords(countdown);
  const setBy = dateSetByLabel(exam);
  const isNumber = countdown.kind === "days";

  return (
    <section
      aria-label={`${exam.board} board exam countdown`}
      className="flex max-w-xl flex-col gap-3.5 border-[1.5px] bg-primary p-5.5 text-primary-foreground shadow-hard-md shadow-ayc-orange"
    >
      <div className="flex justify-between gap-3 font-mono text-xs font-bold tracking-[0.06em]">
        <span className="text-ayc-orange">{exam.board} BOARD EXAM</span>
        <Link
          href={paths.memberApp.account}
          className="text-ayc-on-navy-soft underline underline-offset-2"
        >
          Change date
        </Link>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span
          className={
            isNumber
              ? "text-[clamp(72px,14vw,120px)] leading-[0.85] font-black tracking-[-0.05em]"
              : "text-[clamp(36px,7vw,56px)] leading-none font-black tracking-[-0.03em]"
          }
        >
          {big}
        </span>
        <span className="text-[22px] font-bold">{small}</span>
      </p>
      <p className="font-mono text-xs text-ayc-on-navy-soft uppercase">
        {examDateLabel(exam)}
        {setBy ? ` · ${setBy}` : null}
      </p>
    </section>
  );
}
