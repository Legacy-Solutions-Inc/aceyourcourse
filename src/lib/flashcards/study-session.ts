import type { CardMarkVerdict } from "@/services/content.types";

// ─────────────────────────────────────────────────────────────────────────────
// A Member's pass through a deck in the flashcard player (stories 95 and 97;
// mockups `flashcards` and `deckDone`), as pure functions over the session's
// state: one card at a time, flipped, marked Got it or Review again (the
// latest mark wins), moved with ← and → without marking, then the summary and
// "Review the N", a session over just the cards to review again. The player
// (src/components/member-app/deck-player.tsx) saves each mark on the server
// and the deck position from positionToSave.
// ─────────────────────────────────────────────────────────────────────────────

/** A pass through the whole deck, or "Review the N": a drill over the cards to review again. */
export type SessionScope = "deck" | "review";

export interface StudySession {
  scope: SessionScope;
  /** The session's cards, in deck order. */
  cardIds: readonly string[];
  /** The current card's place in `cardIds`. */
  index: number;
  /** Showing the back. */
  flipped: boolean;
  /** The Member's latest mark on each of the session's cards: their stored ones, then this session's. */
  marks: Readonly<Record<string, CardMarkVerdict>>;
  /** At the summary. */
  finished: boolean;
}

export interface SessionStart {
  cardIds: readonly string[];
  /** The Member's stored marks, by card. */
  marks: Readonly<Record<string, CardMarkVerdict>>;
  scope: SessionScope;
  /** The card to continue from, when it's still in the deck. */
  startAt?: string | null;
}

/** Pure: a session at its first card (or the one to continue from), front up. */
export function startSession({
  cardIds,
  marks,
  scope,
  startAt = null,
}: SessionStart): StudySession {
  const resumed = startAt === null ? -1 : cardIds.indexOf(startAt);
  const kept = Object.fromEntries(
    cardIds.flatMap((id) => {
      const verdict = marks[id];
      return verdict ? [[id, verdict]] : [];
    }),
  );
  return {
    scope,
    cardIds: [...cardIds],
    index: Math.max(resumed, 0),
    flipped: false,
    marks: kept,
    finished: false,
  };
}

/** Pure: the current card, or null at the summary. */
export function currentCard(session: StudySession): string | null {
  return session.finished ? null : (session.cardIds[session.index] ?? null);
}

/** Pure: the card turned over. */
export function flip(session: StudySession): StudySession {
  return session.finished ? session : { ...session, flipped: !session.flipped };
}

/** Pure: the session at another card, front up; forward from the last card is the summary. */
function goTo(session: StudySession, index: number): StudySession {
  if (index >= session.cardIds.length) return { ...session, flipped: false, finished: true };
  return { ...session, index: Math.max(index, 0), flipped: false };
}

/** Pure: the current card marked, and the next one showing (or the summary after the last). */
export function mark(session: StudySession, verdict: CardMarkVerdict): StudySession {
  const card = currentCard(session);
  if (card === null) return session;
  return goTo({ ...session, marks: { ...session.marks, [card]: verdict } }, session.index + 1);
}

/** Pure: ← or →, without marking. */
export function move(session: StudySession, step: -1 | 1): StudySession {
  return session.finished ? session : goTo(session, session.index + step);
}

/** Pure: "Finish deck →": straight to the summary. */
export function finish(session: StudySession): StudySession {
  return { ...session, flipped: false, finished: true };
}

/** The deck summary's counts over the session's cards (mockup `deckDone`). */
export interface SessionSummary {
  total: number;
  got: number;
  again: number;
  /** The cards marked Review again, in deck order: "Review the N". */
  toReview: string[];
}

/** Pure: the summary, from the Member's latest mark on each of the session's cards. */
export function summaryOf(session: StudySession): SessionSummary {
  const toReview = session.cardIds.filter((id) => session.marks[id] === "again");
  const got = session.cardIds.filter((id) => session.marks[id] === "got").length;
  return { total: session.cardIds.length, got, again: toReview.length, toReview };
}

/** Pure: "Review the N": a session over just the cards to review again, keeping their marks. */
export function reviewSession(session: StudySession): StudySession {
  return startSession({
    cardIds: summaryOf(session).toReview,
    marks: session.marks,
    scope: "review",
  });
}

/**
 * Pure: the deck position to save for this session: the card a pass through
 * the deck is on, or none once it's finished, so the deck opens at its start.
 * Null while reviewing, which leaves the position alone.
 */
export function positionToSave(session: StudySession): { cardId: string | null } | null {
  if (session.scope === "review") return null;
  return { cardId: currentCard(session) };
}

/**
 * Pure: the session without the cards no longer in the deck (an Editor
 * deleted one while the Member studied), and their marks. It stays on the
 * current card, or moves on to the next one, front up, when that was the
 * one removed; past the last, it's at the summary. Unchanged, it's the same
 * session.
 */
export function keepCards(session: StudySession, deckCardIds: readonly string[]): StudySession {
  const inDeck = new Set(deckCardIds);
  if (session.cardIds.every((id) => inDeck.has(id))) return session;
  const current = currentCard(session);
  const cardIds = session.cardIds.filter((id) => inDeck.has(id));
  // The kept cards before the current place: where the current card (or the next one) now is.
  const index = session.cardIds.slice(0, session.index).filter((id) => inDeck.has(id)).length;
  return {
    ...session,
    cardIds,
    index,
    marks: Object.fromEntries(Object.entries(session.marks).filter(([id]) => inDeck.has(id))),
    flipped: session.flipped && current !== null && inDeck.has(current),
    finished: session.finished || index >= cardIds.length,
  };
}

/** How the progress bar shows a card (mockup `flashcards`): current, its latest mark, or none. */
export type CardTick = "current" | CardMarkVerdict | "none";

/** Pure: how the progress bar shows one of the session's cards. */
export function tickOf(session: StudySession, cardId: string): CardTick {
  if (cardId === currentCard(session)) return "current";
  return session.marks[cardId] ?? "none";
}
