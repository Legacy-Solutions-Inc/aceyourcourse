"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { paths } from "@/paths";

import type { SwitcherExam } from "./target-exam-view";

interface ExamSwitcherProps {
  /** The Member's Target Exams, in the order added; one is selected. Never empty. */
  exams: readonly SwitcherExam[];
  /** The switch Server Action: its form sends `examCode`. */
  switchAction: (formData: FormData) => Promise<void>;
  /** Wraps "+ Add an exam", so that in the drawer following it closes the drawer. */
  wrapLink?: (link: React.ReactElement) => React.ReactElement;
}

/**
 * The exam switcher (mockup L61–72 and L94–98; BUILD-MAP §2): a card saying
 * which Target Exam the Member is studying for and how long is left, which
 * opens a list of their Target Exams, each with its Exam Date, and "+ Add an
 * exam". Picking one selects it for the whole Member App. Escape closes the
 * list and puts focus back on the card (in the drawer, it closes the drawer).
 */
export function ExamSwitcher({
  exams,
  switchAction,
  wrapLink = (link) => link,
}: ExamSwitcherProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const card = useRef<HTMLButtonElement>(null);
  const current = exams.find((exam) => exam.selected) ?? exams[0];
  if (!current) return null;

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          // The list is about to hide, with whatever in it had focus.
          card.current?.focus();
        }
      }}
    >
      <button
        ref={card}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((was) => !was)}
        className="flex w-full cursor-pointer flex-col gap-1.5 border-[1.5px] bg-primary p-3.5 text-left text-primary-foreground shadow-hard shadow-ayc-orange focus-visible:outline-ayc-orange"
      >
        <span className="flex justify-between font-mono text-[10px] font-medium tracking-[0.06em] text-ayc-on-navy-soft">
          <span>STUDYING FOR</span>
          <span>
            SWITCH <span aria-hidden="true">▾</span>
          </span>
        </span>
        <span className="font-mono text-base font-bold">
          {current.code} · {current.board}
        </span>
        <span className="text-[13px] text-ayc-on-navy-soft">{current.countdown}</span>
      </button>
      <div
        id={listId}
        hidden={!open}
        className="absolute top-full right-0 left-0 z-10 mt-1.5 flex flex-col border-[1.5px] bg-ayc-paper shadow-hard-md"
      >
        <ul aria-label="Your exams">
          {exams.map((exam) => (
            <li key={exam.code} className="border-b border-ayc-rule">
              <form action={switchAction} onSubmit={() => setOpen(false)}>
                <input type="hidden" name="examCode" value={exam.code} />
                <button
                  type="submit"
                  aria-current={exam.selected ? "true" : undefined}
                  className="flex min-h-14 w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left hover:bg-ayc-cream aria-[current]:bg-ayc-cream"
                >
                  <span className="bg-ayc-blue px-1.5 py-1.5 font-mono text-xs leading-none font-bold text-ayc-cream">
                    {exam.code}
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-bold">{exam.name}</span>
                    <span className="text-xs text-muted-foreground">{exam.meta}</span>
                  </span>
                  {exam.selected ? (
                    <span className="font-bold text-ayc-blue">
                      <span aria-hidden="true">✓</span>
                      <span className="sr-only">Selected</span>
                    </span>
                  ) : null}
                </button>
              </form>
            </li>
          ))}
        </ul>
        {wrapLink(
          <Link
            href={paths.memberApp.addExam}
            onClick={() => setOpen(false)}
            className="flex min-h-13 items-center px-3.5 text-sm font-bold text-ayc-blue hover:bg-ayc-cream"
          >
            + Add an exam
          </Link>,
        )}
      </div>
    </div>
  );
}
