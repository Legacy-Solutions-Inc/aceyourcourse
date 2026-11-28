import Link from "next/link";

import type { ShownRefusal } from "@/lib/member-app/access";
import type { MemberProgress } from "@/lib/member-app/progress";
import type { UnlockRoute } from "@/lib/member-app/unlock";
import type { ContentKind } from "@/services/content.types";

import { ContentState } from "./content-state";

/** Pure: what a refused deck keeps (mockup `expired`): the Member's marks on it, when they have any. */
export const cardsKept = (marked: number): string | null =>
  marked === 0 ? null : `${marked} ${marked === 1 ? "card" : "cards"} marked`;

/** Pure: what a refused quiz keeps: the Member's attempts at it and their Best Score, when they have any. */
export const quizKept = (attemptCount: number, bestScore: number | null): string | null =>
  attemptCount === 0 || bestScore === null
    ? null
    : `${attemptCount} ${attemptCount === 1 ? "attempt" : "attempts"}, best score ${bestScore}%`;

/** Pure: what a refused Reviewer PDF keeps: the pages the Member viewed in it, when they viewed any. */
export const pagesKept = (viewed: number): string | null =>
  viewed === 0 ? null : `${viewed} ${viewed === 1 ? "page" : "pages"} viewed`;

/**
 * Pure: what a Member keeps of a whole Exam once their pass ended (Phase 4,
 * ticket 12; mockup `expired`): "312 cards marked, 14 quizzes taken", and the
 * Reviewer PDF pages viewed, leaving out what's none. Cards marked are those
 * last marked Got it or Review again. Null with no progress at all.
 */
export function examKept({
  subjects,
  quizzesTaken,
  pages,
}: Pick<MemberProgress, "subjects" | "quizzesTaken" | "pages">): string | null {
  const marked = subjects
    .flatMap(({ topics }) => topics)
    .reduce((sum, { cards }) => sum + (cards ? cards.got + cards.again : 0), 0);
  const quizzes =
    quizzesTaken === 0 ? null : `${quizzesTaken} ${quizzesTaken === 1 ? "quiz" : "quizzes"} taken`;
  const parts = [cardsKept(marked), quizzes, pagesKept(pages.viewed)].filter(
    (part) => part !== null,
  );
  return parts.length === 0 ? null : parts.join(", ");
}

/**
 * Pure: what a refused deck, quiz or Reviewer PDF says is kept (mockup `expired`): the
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

const BEING_PREPARED: Record<ContentKind, string> = {
  deck: "These flashcards are still being prepared. They’ll show up here automatically.",
  quiz: "This quiz is still being prepared. Its questions will show up here automatically.",
  "reviewer-pdf":
    "This reviewer is still being prepared. Its pages will show up here automatically.",
};

interface EmptyStudyProps extends StudyHeadingProps {
  kind: ContentKind;
  back: { href: string; label: string };
}

/**
 * A deck with no cards yet, a quiz with no questions, or a Reviewer PDF with
 * no pages (mockup `emptyTopic`; story 103): still being prepared, and
 * showing up by itself once Staff add them.
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
  decision: ShownRefusal;
  /** What of the Member's progress on it is kept, such as "3 cards marked", or null for none. */
  kept: string | null;
  examCode: string;
  /** How the Member gets the Exam's All-Access: its Plans, or asking AYC. */
  unlock: UnlockRoute;
  back: { href: string; label: string };
}

/**
 * A deck, quiz or Reviewer PDF the access decision refused (mockup
 * `expired`): the unlock prompt when it's locked, renew when the pass ended,
 * or no longer available when it's Hidden or Unpublished, each keeping the
 * Member's progress. None of its cards, questions or pages is read.
 */
export function RefusedStudy({ crumb, title, decision, kept, ...state }: RefusedStudyProps) {
  return (
    <>
      <StudyHeading crumb={crumb} title={title} />
      <ContentState decision={decision} keptNote={keptNote(decision, kept)} {...state} />
    </>
  );
}
