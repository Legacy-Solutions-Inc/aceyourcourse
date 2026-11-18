import Link from "next/link";

import type { ShownRefusal } from "@/lib/member-app/access";

import { ContentState } from "./content-state";

/** The study screens that show these states: the flashcard player's deck, and a quiz. */
export type StudyKind = "deck" | "quiz";

/** Pure: what a refused deck keeps (mockup `expired`): the Member's marks on it, when they have any. */
export const cardsKept = (marked: number): string | null =>
  marked === 0 ? null : `${marked} ${marked === 1 ? "card" : "cards"} marked`;

/** Pure: what a refused quiz keeps: the Member's attempts at it and their Best Score, when they have any. */
export const quizKept = (attemptCount: number, bestScore: number | null): string | null =>
  attemptCount === 0 || bestScore === null
    ? null
    : `${attemptCount} ${attemptCount === 1 ? "attempt" : "attempts"}, best score ${bestScore}%`;

/**
 * Pure: what a refused deck or quiz says is kept (mockup `expired`): the
 * Member's own progress on it, when they have any, and to renew when their
 * pass ended.
 */
export function keptNote(decision: ShownRefusal, kept: string | null): string {
  const note = kept === null ? "Your progress is kept." : `Your progress is kept: ${kept}.`;
  return decision.outcome === "expired" ? `Renew to keep reviewing. ${note}` : note;
}

interface StudyHeadingProps {
  /** The mono label over the title, such as "MSTC · FLASHCARDS". */
  crumb: string;
  title: string;
}

function StudyHeading({ crumb, title }: StudyHeadingProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-xs font-medium tracking-[0.06em] text-ayc-blue">{crumb}</p>
      <h1 className="text-[clamp(26px,3vw,36px)] leading-[1.1] font-extrabold tracking-[-0.03em]">
        {title}
      </h1>
    </div>
  );
}

const BEING_PREPARED: Record<StudyKind, string> = {
  deck: "These flashcards are still being prepared. They’ll show up here automatically.",
  quiz: "This quiz is still being prepared. Its questions will show up here automatically.",
};

interface EmptyStudyProps extends StudyHeadingProps {
  kind: StudyKind;
  back: { href: string; label: string };
}

/**
 * A deck with no cards yet, or a quiz with no questions (mockup
 * `emptyTopic`; story 103): still being prepared, and showing up by itself
 * once Staff add them.
 */
export function EmptyStudy({ crumb, title, kind, back }: EmptyStudyProps) {
  return (
    <>
      <StudyHeading crumb={crumb} title={title} />
      <section
        aria-labelledby="empty-study"
        className="mx-auto flex w-full max-w-155 flex-col items-center gap-3 border-[1.5px] border-dashed border-ayc-slate p-6 text-center wide:my-6 wide:p-9"
      >
        <span
          aria-hidden="true"
          className="font-mono text-[40px] leading-none font-bold text-ayc-rule"
        >
          ∅
        </span>
        <h2 id="empty-study" className="text-[22px] font-extrabold">
          Nothing here yet
        </h2>
        <p className="max-w-[36ch] text-[15px] leading-normal">{BEING_PREPARED[kind]}</p>
        <Link
          href={back.href}
          className="flex min-h-12 items-center border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground"
        >
          {back.label}
        </Link>
      </section>
    </>
  );
}

interface RefusedStudyProps extends StudyHeadingProps {
  kind: StudyKind;
  decision: ShownRefusal;
  /** What of the Member's progress on it is kept, such as "3 cards marked", or null for none. */
  kept: string | null;
  examCode: string;
  contactEmail: string;
  back: { href: string; label: string };
}

/**
 * A deck or quiz the access decision refused (mockup `expired`): the unlock
 * prompt when it's locked, renew when the pass ended, or no longer available
 * when it's Hidden, each keeping the Member's progress. None of its cards or
 * questions is read.
 */
export function RefusedStudy({ crumb, title, decision, kept, ...state }: RefusedStudyProps) {
  return (
    <>
      <StudyHeading crumb={crumb} title={title} />
      <ContentState decision={decision} keptNote={keptNote(decision, kept)} {...state} />
    </>
  );
}
