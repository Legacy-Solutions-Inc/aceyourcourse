import Link from "next/link";

import type { ShownRefusal } from "@/lib/member-app/access";

import { ContentState } from "./content-state";

/**
 * Pure: what a refused deck says is kept (mockup `expired`): the Member's own
 * marks on it, when they have any, and to renew when their pass ended.
 */
export function keptNote(decision: ShownRefusal, marked: number): string {
  const kept =
    marked === 0
      ? "Your progress is kept."
      : `Your progress is kept: ${marked} ${marked === 1 ? "card" : "cards"} marked.`;
  return decision.outcome === "expired" ? `Renew to keep reviewing. ${kept}` : kept;
}

interface DeckHeadingProps {
  /** The mono label over the title, such as "MSTC · FLASHCARDS". */
  crumb: string;
  title: string;
}

function DeckHeading({ crumb, title }: DeckHeadingProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-xs font-medium tracking-[0.06em] text-ayc-blue">{crumb}</p>
      <h1 className="text-[clamp(26px,3vw,36px)] leading-[1.1] font-extrabold tracking-[-0.03em]">
        {title}
      </h1>
    </div>
  );
}

interface EmptyDeckProps extends DeckHeadingProps {
  back: { href: string; label: string };
}

/**
 * A deck with no cards yet (mockup `emptyTopic`; story 103): the Topic's
 * flashcards are still being prepared, and show up by themselves once Staff
 * add them.
 */
export function EmptyDeck({ crumb, title, back }: EmptyDeckProps) {
  return (
    <>
      <DeckHeading crumb={crumb} title={title} />
      <section
        aria-labelledby="empty-deck"
        className="mx-auto flex w-full max-w-155 flex-col items-center gap-3 border-[1.5px] border-dashed border-ayc-slate p-6 text-center wide:my-6 wide:p-9"
      >
        <span
          aria-hidden="true"
          className="font-mono text-[40px] leading-none font-bold text-ayc-rule"
        >
          ∅
        </span>
        <h2 id="empty-deck" className="text-[22px] font-extrabold">
          Nothing here yet
        </h2>
        <p className="max-w-[36ch] text-[15px] leading-normal">
          These flashcards are still being prepared. They’ll show up here automatically.
        </p>
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

interface RefusedDeckProps extends DeckHeadingProps {
  decision: ShownRefusal;
  /** How many of the deck's cards the Member had marked: kept. */
  marked: number;
  examCode: string;
  contactEmail: string;
  back: { href: string; label: string };
}

/**
 * A deck the access decision refused (mockup `expired`): the unlock prompt
 * when it's locked, renew when the pass ended, or no longer available when
 * it's Hidden, each keeping the Member's marks. None of its cards is read.
 */
export function RefusedDeck({ crumb, title, decision, marked, ...state }: RefusedDeckProps) {
  return (
    <>
      <DeckHeading crumb={crumb} title={title} />
      <ContentState
        decision={decision}
        kind="deck"
        keptNote={keptNote(decision, marked)}
        {...state}
      />
    </>
  );
}
