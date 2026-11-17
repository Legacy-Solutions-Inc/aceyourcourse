"use client";

import { useActionState, useId, useState } from "react";

import type { ExamFormState } from "@/app/app/(shell)/actions";
import { formatDate } from "@/lib/manila-time";
import type { PickableExam } from "@/services/member.types";

const IDLE: ExamFormState = { error: null };

interface ExamFormProps {
  /** The Exams the Member can pick, in the catalogue's order. Never empty. */
  exams: readonly PickableExam[];
  /** Today in Asia/Manila (YYYY-MM-DD): the earliest date the field offers. */
  today: string;
  /** The button's label: "Start my countdown", or "Add exam". */
  submitLabel: string;
  /** The add Server Action. */
  action: (previous: ExamFormState, formData: FormData) => Promise<ExamFormState>;
}

/**
 * Picks an Exam and its Exam Date: onboarding's "Step 1" (mockup `newUser`)
 * and the add form. The Exam pills are radio buttons, so they can be selected
 * (the mockup's couldn't). Picking an Exam fills the date with its Official
 * Exam Date until the Member types one of their own; an Exam without one
 * needs a date. The checks here are a convenience: the action decides.
 */
export function ExamForm({ exams, today, submitLabel, action }: ExamFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [code, setCode] = useState(exams[0]?.code ?? "");
  const [date, setDate] = useState(exams[0]?.officialExamDate ?? "");
  const [ownDate, setOwnDate] = useState(false);
  const hintId = useId();
  const errorId = useId();

  const picked = exams.find((exam) => exam.code === code);
  const official = picked?.officialExamDate ?? null;

  function pick(exam: PickableExam) {
    setCode(exam.code);
    if (!ownDate) setDate(exam.officialExamDate ?? "");
  }

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <fieldset>
        <legend className="sr-only">Your exam</legend>
        <div className="flex flex-wrap gap-1.5">
          {exams.map((exam) => (
            <label key={exam.code} className="cursor-pointer">
              <input
                type="radio"
                name="examCode"
                value={exam.code}
                required
                checked={exam.code === code}
                onChange={() => pick(exam)}
                className="peer sr-only"
              />
              <span
                title={exam.name}
                className="flex min-h-11 items-center border-[1.5px] bg-background px-3.5 font-mono text-[13px] font-bold peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ayc-blue"
              >
                {exam.code}
                <span className="sr-only"> · {exam.name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Exam date
        <input
          type="date"
          name="examDate"
          value={date}
          // The Official Exam Date is offered as it is, even once it has passed.
          min={official !== null && official < today ? official : today}
          required={official === null}
          onChange={(event) => {
            setDate(event.target.value);
            setOwnDate(event.target.value !== "");
          }}
          aria-describedby={state.error ? `${hintId} ${errorId}` : hintId}
          className="min-h-12 w-full min-w-0 border-[1.5px] bg-white px-3 text-base font-semibold"
        />
      </label>
      <p id={hintId} className="text-sm text-muted-foreground">
        {picked && official
          ? `The official ${picked.board} exam date is ${formatDate(official)}. Change it if yours is different.`
          : `There’s no official ${picked?.board ?? "exam"} date yet. Enter your exam date.`}
      </p>
      {state.error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 cursor-pointer items-center self-start border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground disabled:cursor-wait"
      >
        {submitLabel}
      </button>
    </form>
  );
}
