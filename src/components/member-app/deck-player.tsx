"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { StudyActionState } from "@/app/app/(shell)/library/actions";
import { CardFace } from "@/components/flashcards/card-face";
import { FormulaText } from "@/components/formula/formula-text";
import {
  type CardTick,
  currentCard,
  finish,
  flip,
  keepCards,
  mark,
  move,
  positionToSave,
  reviewSession,
  type StudySession,
  startSession,
  summaryOf,
  tickOf,
} from "@/lib/flashcards/study-session";
import { cn } from "@/lib/utils";
import type { CardMarkVerdict } from "@/services/content.types";
import type { StudyMarkInput, StudyPositionInput } from "@/services/member.schema";
import type { StudyCard } from "@/services/member.types";

import type { ShownRefusal } from "@/lib/member-app/access";

import { ContentState } from "./content-state";
import { keptNote } from "./study-states";

/** The Server Actions the player calls (src/app/app/(shell)/library/actions.ts). */
export interface DeckPlayerActions {
  markCard: (input: StudyMarkInput) => Promise<StudyActionState>;
  savePosition: (input: StudyPositionInput) => Promise<StudyActionState>;
}

export interface DeckPlayerProps {
  deckId: string;
  /** The Topic's name. */
  title: string;
  /** The label over each card, such as "MSTC · SIMPLE CURVES". */
  label: string;
  /** In the deck's order. Never empty: an empty deck shows that it's being prepared instead. */
  cards: StudyCard[];
  /** The Member's latest mark on each card they've marked. */
  marks: Record<string, CardMarkVerdict>;
  /** The card they left the deck at, or null. */
  resumeAt: string | null;
  /** When the image URLs stop working (ISO), or null. */
  imagesExpireAt: string | null;
  /** The Member's email and short Member ID, tiled over every card. */
  watermark: string;
  examCode: string;
  /** Where Members ask AYC for access during the beta. */
  contactEmail: string;
  back: { href: string; label: string };
  actions: DeckPlayerActions;
}

/** How far a card is dragged before letting go marks it (mockup `flashcards`). */
const SWIPE = 90;
/** How far a press moves before it's a drag, not a tap. */
const DRAG_START = 6;
/** The deck is read again this long before its image URLs stop working, for fresh ones. */
const REFRESH_EARLY = 60 * 1000;

const TICKS: Record<CardTick, string> = {
  current: "bg-ayc-orange",
  got: "bg-ayc-blue",
  again: "bg-destructive",
  none: "bg-ayc-sand",
};

/** Whether a key press is the Member's to the player: no modifier held, and not held down. */
const isPlainKey = (event: KeyboardEvent) =>
  !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey;

const CONTROLS = "button, a, input, select, textarea, summary, [role='button']";

/**
 * Whether Space belongs to the focused control: a button or link that isn't
 * one of the card's own controls (Finish deck, Back) keeps Space for itself.
 */
const keepsSpace = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(CONTROLS) !== null &&
  target.closest("[data-card-controls]") === null;

/**
 * The flashcard player (stories 95–97 and 106; mockups `flashcards` and
 * `deckDone`): one card at a time, flipped with a tap, the Flip card button
 * or space, and marked Got it or Review again with a swipe, the buttons, →
 * or ←. ← and → buttons move without marking. Every mark is saved on the
 * server with where the Member is in the deck; finishing clears it. The
 * summary counts the Member's latest marks over the session's cards, and
 * "Review the N" drills just those marked Review again. The Member's email
 * and short Member ID are tiled over each card, and nothing on it can be
 * selected. A refused save (the deck hidden, the pass ended) shows why, in
 * place of the cards.
 */
export function DeckPlayer({
  deckId,
  title,
  label,
  cards,
  marks,
  resumeAt,
  imagesExpireAt,
  watermark,
  examCode,
  contactEmail,
  back,
  actions,
}: DeckPlayerProps) {
  const router = useRouter();
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  // Each card as the page read it last: a fresh read brings fresh image URLs.
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const resumeIndex = resumeAt === null ? -1 : cardIds.indexOf(resumeAt);

  // The session starts from what the page read when it opened; a later read
  // (for fresh image URLs) doesn't restart it.
  const [session, setSession] = useState(() =>
    startSession({ cardIds, marks, scope: "deck", startAt: null }),
  );
  const sessionRef = useRef(session);
  const [offering, setOffering] = useState(resumeIndex > 0);
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null);
  const [drag, setDrag] = useState(0);
  const pointer = useRef<{ id: number; x0: number; moved: boolean } | null>(null);
  const player = useRef<HTMLElement>(null);

  const apply = useCallback((next: StudySession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Sends a save, then says why it didn't go through, if it didn't. */
  const save = useCallback(async (send: () => Promise<StudyActionState>) => {
    try {
      const state = await send();
      if (state.status === "refused") setRefusal(state.decision);
      if (state.status === "not-found") toast("That card was just removed from the deck.");
    } catch (error) {
      // A redirect (a replaced device, a closed gate) isn't a failure: Next follows it.
      unstable_rethrow(error);
      toast("Couldn’t save that. Check your connection.");
    }
  }, []);

  /** Saves where a pass through the deck is now; reviewing leaves it alone. */
  const savePosition = useCallback(
    (next: StudySession) => {
      const position = positionToSave(next);
      if (position) void save(() => actions.savePosition({ deckId, cardId: position.cardId }));
    },
    [actions, deckId, save],
  );

  const markCurrent = useCallback(
    (verdict: CardMarkVerdict) => {
      const now = sessionRef.current;
      const cardId = currentCard(now);
      if (cardId === null) return;
      const next = mark(now, verdict);
      apply(next);
      void save(() =>
        actions.markCard({ deckId, cardId, verdict, position: positionToSave(next) }),
      );
    },
    [actions, apply, deckId, save],
  );

  const moveBy = useCallback(
    (step: -1 | 1) => {
      const next = move(sessionRef.current, step);
      apply(next);
      savePosition(next);
    },
    [apply, savePosition],
  );

  const flipCard = useCallback(() => apply(flip(sessionRef.current)), [apply]);

  // A card an Editor deletes while the Member studies leaves the session once
  // the page reads the deck again; one they add joins when the deck reopens.
  useEffect(() => {
    const kept = keepCards(sessionRef.current, cardIds);
    if (kept !== sessionRef.current) apply(kept);
  }, [cardIds, apply]);

  // Space flips, → is Got it, ← is Review again, while a card is showing:
  // with nothing focused, or focus in the player, never in the menu beside it.
  const studying = refusal === null && !offering && !session.finished;
  useEffect(() => {
    if (!studying) return;
    function onKey(event: KeyboardEvent) {
      const { target } = event;
      const inPlayer =
        !(target instanceof Element) ||
        target === document.body ||
        (player.current?.contains(target) ?? false);
      if (!inPlayer || !isPlainKey(event)) return;
      if (event.key === " ") {
        if (keepsSpace(target)) return;
        // Also keeps a focused card control from taking the space as a click.
        event.preventDefault();
        flipCard();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        markCurrent("got");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        markCurrent("again");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studying, flipCard, markCurrent]);

  // Fresh image URLs before these stop working: the page reads the deck again.
  useEffect(() => {
    if (!imagesExpireAt) return;
    const wait = Math.max(Date.parse(imagesExpireAt) - Date.now() - REFRESH_EARLY, 0);
    const timer = setTimeout(() => router.refresh(), wait);
    return () => clearTimeout(timer);
  }, [imagesExpireAt, router]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    pointer.current = { id: event.pointerId, x0: event.clientX, moved: false };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const press = pointer.current;
    if (!press || press.id !== event.pointerId) return;
    const dx = event.clientX - press.x0;
    if (!press.moved && Math.abs(dx) > DRAG_START) {
      press.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (press.moved) setDrag(dx);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const press = pointer.current;
    pointer.current = null;
    setDrag(0);
    if (!press || press.id !== event.pointerId) return;
    const dx = event.clientX - press.x0;
    if (!press.moved) flipCard();
    else if (Math.abs(dx) > SWIPE) markCurrent(dx > 0 ? "got" : "again");
  }

  function onPointerCancel() {
    pointer.current = null;
    setDrag(0);
  }

  function startAt(cardId: string | null) {
    const next = startSession({
      cardIds,
      marks: sessionRef.current.marks,
      scope: "deck",
      startAt: cardId,
    });
    setOffering(false);
    apply(next);
    if (cardId === null) savePosition(next);
  }

  const total = session.cardIds.length;
  const shown = byId.get(currentCard(session) ?? "");

  return (
    <section
      ref={player}
      aria-label={`${title} flashcards`}
      className="flex flex-col gap-4 select-none [-webkit-touch-callout:none] wide:gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h1 className="text-[clamp(22px,2.6vw,30px)] leading-[1.1] font-extrabold tracking-[-0.02em]">
          {title}
        </h1>
        {studying ? (
          <span className="font-mono text-[13px] font-bold">
            {session.scope === "review" ? "REVIEW · " : ""}CARD {session.index + 1} / {total}
          </span>
        ) : null}
      </div>

      {refusal ? (
        <ContentState
          decision={refusal}
          kind="deck"
          // The count of what was saved shows when the deck is opened again.
          keptNote={keptNote(refusal, null)}
          examCode={examCode}
          contactEmail={contactEmail}
          back={back}
        />
      ) : offering ? (
        <section
          aria-labelledby="resume-offer"
          className="mx-auto flex w-full max-w-160 flex-col gap-3 border-[1.5px] bg-ayc-paper p-5 shadow-hard"
        >
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
            PICK UP WHERE YOU LEFT OFF
          </p>
          <h2 id="resume-offer" className="text-[22px] leading-[1.15] font-extrabold">
            You stopped at card {resumeIndex + 1} of {cardIds.length}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startAt(resumeAt)}
              className="min-h-12 cursor-pointer border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground"
            >
              Continue at card {resumeIndex + 1}
            </button>
            <button
              type="button"
              onClick={() => startAt(null)}
              className="min-h-12 cursor-pointer border-[1.5px] px-4.5 text-[15px] font-bold"
            >
              Start from card 1
            </button>
          </div>
        </section>
      ) : session.finished ? (
        <DeckSummary
          title={title}
          session={session}
          byId={byId}
          back={back}
          onReview={() => apply(reviewSession(sessionRef.current))}
        />
      ) : (
        <>
          <div aria-hidden="true" className="flex h-1.5 gap-[3px]">
            {session.cardIds.map((id) => (
              <span key={id} className={cn("flex-1", TICKS[tickOf(session, id)])} />
            ))}
          </div>
          <div className="flex justify-center">
            <div
              data-testid="card-stage"
              aria-live="polite"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              className="relative w-full max-w-160 cursor-grab touch-pan-y [&_img]:pointer-events-none"
              style={
                drag ? { transform: `translateX(${drag}px) rotate(${drag / 28}deg)` } : undefined
              }
            >
              {shown ? (
                <CardFace
                  side={session.flipped ? "back" : "front"}
                  label={label}
                  text={session.flipped ? shown.back : shown.front}
                  note={session.flipped ? shown.note : null}
                  imageSrc={session.flipped ? shown.imageUrl : null}
                  watermark={watermark}
                  className="p-5 shadow-[8px_8px_0_-1.5px_var(--ayc-sand),8px_8px_0_0_var(--ayc-navy)] wide:p-6"
                />
              ) : null}
              <SwipeHint verdict="got" strength={drag / SWIPE} />
              <SwipeHint verdict="again" strength={-drag / SWIPE} />
            </div>
          </div>
          <div data-card-controls="" className="contents">
            <button
              type="button"
              onClick={flipCard}
              aria-label="Flip card"
              className="cursor-pointer self-center px-3 py-2 font-mono text-[11px] font-medium text-muted-foreground"
            >
              TAP TO FLIP · SWIPE → GOT IT · ← REVIEW AGAIN
            </button>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => moveBy(-1)}
                disabled={session.index === 0}
                aria-label="Previous card"
                className="min-h-13 min-w-13 cursor-pointer border-[1.5px] text-lg font-bold disabled:cursor-default disabled:opacity-40"
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                type="button"
                onClick={() => markCurrent("again")}
                className="min-h-13 cursor-pointer border-[1.5px] bg-ayc-orange px-5 text-[15px] font-bold text-ayc-navy"
              >
                Review again
              </button>
              <button
                type="button"
                onClick={() => markCurrent("got")}
                className="min-h-13 cursor-pointer border-[1.5px] bg-ayc-blue px-5 text-[15px] font-bold text-ayc-cream"
              >
                Got it
              </button>
              <button
                type="button"
                onClick={() => moveBy(1)}
                aria-label="Next card, without marking"
                className="min-h-13 min-w-13 cursor-pointer border-[1.5px] text-lg font-bold"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = finish(sessionRef.current);
              apply(next);
              savePosition(next);
            }}
            className="cursor-pointer self-center px-2 py-1 text-sm font-semibold text-ayc-blue"
          >
            Finish deck →
          </button>
          <p className="text-center font-mono text-xs text-muted-foreground">
            Keyboard: ← review again · → got it · space flips. Marked cards count toward your
            progress.
          </p>
        </>
      )}
    </section>
  );
}

/** The overlay that grows as a card is dragged towards a mark (mockup `flashcards`). */
function SwipeHint({ verdict, strength }: { verdict: CardMarkVerdict; strength: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ opacity: Math.max(0, Math.min(1, strength)) }}
      className={cn(
        "pointer-events-none absolute top-13 z-10 border-[1.5px] px-3 py-2 font-mono text-base font-extrabold tracking-[0.06em]",
        verdict === "got"
          ? "right-4 rotate-8 bg-ayc-blue text-ayc-cream"
          : "left-4 -rotate-8 bg-ayc-orange text-ayc-navy",
      )}
    >
      {verdict === "got" ? "GOT IT ✓" : "REVIEW AGAIN ↺"}
    </span>
  );
}

interface DeckSummaryProps {
  title: string;
  session: StudySession;
  byId: ReadonlyMap<string, StudyCard>;
  back: { href: string; label: string };
  onReview: () => void;
}

/** The summary at the end of a session (mockup `deckDone`): "41 of 48 got it · 7 to review again". */
function DeckSummary({ title, session, byId, back, onReview }: DeckSummaryProps) {
  const summary = summaryOf(session);
  const { total, got, again, toReview } = summary;
  const share = (count: number) => `${total ? (count / total) * 100 : 0}%`;
  return (
    <section
      aria-labelledby="deck-done"
      className="mx-auto flex w-full max-w-160 flex-col gap-4 border-[1.5px] bg-ayc-paper p-5 shadow-[6px_6px_0_var(--ayc-blue)] wide:my-4 wide:p-8"
    >
      <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
        {session.scope === "review" ? "REVIEW FINISHED" : "DECK FINISHED"} · {title.toUpperCase()}
      </p>
      <h2 id="deck-done" className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-[clamp(56px,7vw,80px)] leading-[0.9] font-black tracking-[-0.04em]">
          {got}
        </span>{" "}
        <span className="text-xl font-bold">
          of {total} got it · {again} to review again
        </span>
      </h2>
      <div aria-hidden="true" className="flex h-3 border-[1.5px]">
        <span className="bg-ayc-blue" style={{ width: share(got) }} />
        <span className="bg-ayc-orange" style={{ width: share(again) }} />
      </div>
      {again > 0 ? (
        <>
          <p
            aria-hidden="true"
            className="font-mono text-[11px] font-bold tracking-[0.06em] text-muted-foreground"
          >
            {again} TO REVIEW AGAIN
          </p>
          <ul aria-label="Cards to review again" className="flex flex-wrap gap-1.5">
            {toReview.map((id) => (
              <li
                key={id}
                className="border-[1.5px] bg-white px-2.5 py-1.5 text-[13px] font-semibold"
              >
                <FormulaText text={byId.get(id)?.front ?? ""} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-2">
        {again > 0 ? (
          <button
            type="button"
            onClick={onReview}
            className="min-h-12 cursor-pointer border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground"
          >
            Review the {again}
          </button>
        ) : null}
        <Link
          href={back.href}
          className="flex min-h-12 items-center border-[1.5px] px-4.5 text-[15px] font-bold"
        >
          {back.label}
        </Link>
      </div>
    </section>
  );
}
