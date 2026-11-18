"use server";

import { redirect } from "next/navigation";

import type { ShownRefusal } from "@/lib/member-app/access";
import { readMemberAccess, shownRefusal } from "@/lib/member-app/access-check";
import { requireMember } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { markCard, saveDeckPosition, submitQuiz } from "@/services/member";
import {
  isRecordId,
  quizSubmitSchema,
  studyMarkSchema,
  studyPositionSchema,
} from "@/services/member.schema";
import type { ScoredAttempt, StudyRefusal } from "@/services/member.types";

// The flashcard player's actions (ticket 08; spec, Phase 3 → Progress storage
// and Resume) and the quiz screen's (ticket 11; spec, Phase 3 → Quizzes are
// graded on the server). Each one runs the Member App's server checks first
// (the gate, consent, then the Active Device), takes who the Member is from
// the session alone, and passes the access decision's inputs, gathered now,
// to the Member seam, which decides the deck or quiz before it writes
// anything. Nothing the browser sends is trusted: a card id that isn't one, a
// quiz the Member may no longer open, or answers to questions that aren't
// the quiz's change nothing, and the seam marks the answers itself.

/** What the player hears back: saved, or why not, so it can say so. */
export type StudyActionState =
  | { status: "saved" }
  /** The access decision refused the deck: locked, expired, or no longer available. */
  | { status: "refused"; decision: ShownRefusal }
  /** No such card in the deck, or what was sent doesn't name one. */
  | { status: "not-found" };

/** The signed-in Member, past every check, and their side of the access decision now. */
async function memberAndAccess(from: string) {
  const member = await requireMember(from);
  const access = await readMemberAccess();
  if (!access) redirect(paths.memberApp.signIn(from));
  return { member, access };
}

/**
 * What a refusal shows: a replaced device goes to the Active Device screen
 * and a closed gate to "Not open yet", as requireMember sends them; the rest
 * the player shows in place of the card.
 */
function refusalState(
  refusal: StudyRefusal,
  from: string,
): Extract<StudyActionState, { status: "refused" | "not-found" }> {
  if (refusal.reason === "not-found") return { status: "not-found" };
  return { status: "refused", decision: shownRefusal(refusal.decision, from) };
}

/** The deck's page, which the checks' redirects come back to: the Library when there's no deck. */
function deckPath(input: unknown): string {
  const sent = studyPositionSchema.pick({ deckId: true }).safeParse(input);
  return sent.success ? paths.memberApp.content("deck", sent.data.deckId) : paths.memberApp.library;
}

/**
 * "Got it" or "Review again" (a button, → or ←, or a swipe): saves the mark,
 * which counts the day as a Study Day, then where the Member is in the deck.
 */
export async function markStudyCard(input: unknown): Promise<StudyActionState> {
  const from = deckPath(input);
  const { member, access } = await memberAndAccess(from);
  const sent = studyMarkSchema.safeParse(input);
  if (!sent.success) return { status: "not-found" };

  const { deckId, cardId, verdict, position } = sent.data;
  const marked = await markCard(member.userId, { cardId, verdict }, access);
  if (!marked.ok) return refusalState(marked.refusal, from);
  if (position) {
    const saved = await saveDeckPosition(
      member.userId,
      { deckId, cardId: position.cardId },
      access,
    );
    if (!saved.ok) return refusalState(saved.refusal, from);
  }
  return { status: "saved" };
}

/** ← or → without marking, "Finish deck", or picking where to start: saves where the Member is. */
export async function saveStudyPosition(input: unknown): Promise<StudyActionState> {
  const from = deckPath(input);
  const { member, access } = await memberAndAccess(from);
  const sent = studyPositionSchema.safeParse(input);
  if (!sent.success) return { status: "not-found" };

  const saved = await saveDeckPosition(member.userId, sent.data, access);
  return saved.ok ? { status: "saved" } : refusalState(saved.refusal, from);
}

/** What the quiz screen hears back from Submit: the marking, or why there's none. */
export type QuizActionState =
  /** Marked and saved (or saved already, when the same attempt was sent again). */
  | { status: "scored"; scored: ScoredAttempt }
  /** The access decision refused the quiz: locked, expired, or no longer available. */
  | { status: "refused"; decision: ShownRefusal }
  /** No such quiz, or the attempt's id is another Member's or another quiz's. */
  | { status: "not-found" }
  /** The answers don't match the quiz: a question that isn't its own, or one answered twice. */
  | { status: "mismatch" };

/** The quiz's page, which the checks' redirects come back to: the Library when there's no quiz. */
function quizPath(input: unknown): string {
  const sent = quizSubmitSchema.pick({ quizId: true }).safeParse(input);
  return sent.success && isRecordId(sent.data.quizId)
    ? paths.memberApp.content("quiz", sent.data.quizId)
    : paths.memberApp.library;
}

/**
 * "Finish quiz": sends the attempt's answers, which the seam marks against the
 * quiz as it is now, saving the Quiz Attempt and the day as a Study Day. The
 * attempt's own id comes with it, so sending it again (a double click, a
 * retry after a dropped connection) saves it once and gives the same marking.
 */
export async function submitQuizAttempt(input: unknown): Promise<QuizActionState> {
  const from = quizPath(input);
  const { member, access } = await memberAndAccess(from);
  const sent = quizSubmitSchema.safeParse(input);
  if (!sent.success) return { status: "mismatch" };

  const result = await submitQuiz(member.userId, sent.data, access);
  if (result.ok) return { status: "scored", scored: result.value };
  if (result.refusal.reason === "mismatch") return { status: "mismatch" };
  return refusalState(result.refusal, from);
}
