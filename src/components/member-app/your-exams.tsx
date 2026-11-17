"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import type { ExamDateState, ExamFormState } from "@/app/app/(shell)/actions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { paths } from "@/paths";

import type { YourExam } from "./target-exam-view";

interface YourExamsProps {
  /** The Member's Target Exams, in the order added. Never empty. */
  exams: readonly YourExam[];
  /** Today in Asia/Manila (YYYY-MM-DD): the earliest date the fields offer. */
  today: string;
  changeDateAction: (previous: ExamDateState, formData: FormData) => Promise<ExamDateState>;
  removeAction: (previous: ExamFormState, formData: FormData) => Promise<ExamFormState>;
}

const DATE_IDLE: ExamDateState = { error: null, saved: false };
const REMOVE_IDLE: ExamFormState = { error: null };

const smallButton =
  "flex min-h-11 cursor-pointer items-center border-[1.5px] px-3.5 text-sm font-bold disabled:cursor-not-allowed";

/**
 * Account's "Your exams" (spec, Phase 3 → Target Exams; stories 85, 86,
 * 133g): each Target Exam with its Exam Date to edit and Remove, then
 * "+ Add an exam". Removing asks first, and isn't offered for the Member's
 * only Target Exam; the action refuses it too.
 */
export function YourExams({ exams, today, changeDateAction, removeAction }: YourExamsProps) {
  const only = exams.length === 1;
  return (
    <div className="flex flex-col gap-3.5">
      <ul className="flex flex-col gap-3.5">
        {exams.map((exam) => (
          <li key={exam.code}>
            <YourExamRow
              exam={exam}
              today={today}
              only={only}
              changeDateAction={changeDateAction}
              removeAction={removeAction}
            />
          </li>
        ))}
      </ul>
      {only ? (
        <p className="text-sm text-muted-foreground">
          This is your only exam, so it can’t be removed. Add another one first.
        </p>
      ) : null}
      <Link
        href={paths.memberApp.addExam}
        className="flex min-h-11 items-center self-start font-bold text-ayc-blue underline underline-offset-2"
      >
        + Add an exam
      </Link>
    </div>
  );
}

interface YourExamRowProps extends Omit<YourExamsProps, "exams"> {
  exam: YourExam;
  /** It's the Member's only Target Exam, which can't be removed. */
  only: boolean;
}

function YourExamRow({ exam, today, only, changeDateAction, removeAction }: YourExamRowProps) {
  const [dateState, dateAction, saving] = useActionState(changeDateAction, DATE_IDLE);
  const [removeState, removeFormAction, removing] = useActionState(removeAction, REMOVE_IDLE);
  const [confirming, setConfirming] = useState(false);
  const headingId = useId();
  const messageId = useId();

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-3 border-[1.5px] bg-ayc-paper p-4"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="bg-ayc-blue px-1.5 py-1.5 font-mono text-xs leading-none font-bold text-ayc-cream">
          {exam.code}
        </span>
        <h3 id={headingId} className="text-lg font-extrabold">
          {exam.name}
        </h3>
        {exam.selected ? (
          <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
            STUDYING NOW
          </span>
        ) : null}
      </div>
      <p className="text-sm">
        {exam.dateLabel}
        {exam.setByLabel ? ` · ${exam.setByLabel}` : null} · {exam.countdown}
      </p>
      <form action={dateAction} className="flex flex-wrap items-end gap-2.5">
        <input type="hidden" name="examCode" value={exam.code} />
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          {exam.code} exam date
          <input
            type="date"
            name="examDate"
            defaultValue={exam.examDate}
            min={today}
            required
            aria-describedby={dateState.error || dateState.saved ? messageId : undefined}
            className="min-h-11 border-[1.5px] bg-white px-3 text-base font-semibold"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className={`${smallButton} bg-primary text-primary-foreground`}
        >
          Save date
        </button>
        <button
          type="button"
          disabled={only}
          onClick={() => setConfirming(true)}
          className={`${smallButton} text-destructive disabled:text-muted-foreground`}
        >
          Remove<span className="sr-only"> {exam.code}</span>
        </button>
      </form>
      {dateState.error ? (
        <p id={messageId} role="alert" className="text-sm font-semibold text-destructive">
          {dateState.error}
        </p>
      ) : dateState.saved ? (
        <p id={messageId} role="status" className="text-sm font-semibold text-ayc-success">
          Date saved.
        </p>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(480px,calc(100%-2rem))] gap-0 rounded-none border-[1.5px] bg-background p-0 shadow-hard-lg sm:max-w-[min(480px,calc(100%-2rem))]"
        >
          <p className="border-b-[1.5px] bg-destructive px-4.5 py-3 font-mono text-xs font-bold tracking-[0.06em] text-white">
            REMOVE EXAM
          </p>
          <div className="flex min-w-0 flex-col gap-3 px-5 pt-5 pb-5.5">
            <DialogTitle className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.01em]">
              Remove {exam.code} from your exams?
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-normal text-foreground">
              {exam.name} leaves your exam switcher and Home. Your progress and exam date are kept,
              and adding it back restores them.
            </DialogDescription>
            {removeState.error ? (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {removeState.error}
              </p>
            ) : null}
            <form action={removeFormAction} className="mt-1 flex flex-wrap justify-end gap-2">
              <input type="hidden" name="examCode" value={exam.code} />
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={`${smallButton} bg-transparent`}
              >
                Keep it
              </button>
              <button
                type="submit"
                disabled={removing}
                className={`${smallButton} bg-destructive text-white`}
              >
                Remove {exam.code}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
