import { formulaFieldProblem } from "@/lib/formula/field";

import { CARD_TEXT_LIMITS } from "./card-rules";

// ─────────────────────────────────────────────────────────────────────────────
// A card's fields as the card editor judges them (Phase 3, ticket 07; spec,
// Phase 3 → Content model; story 125), pure, so the browser checks a card
// before it uploads or saves anything, and the Admin seam checks it again:
//   - the front and the back are required, the note optional,
//   - each has the import's length limit (card-rules.ts), counted as
//     Postgres counts characters, on the text as saved (trimmed),
//   - each must render: the formula notation is read, and every formula is
//     put through KaTeX (src/lib/formula/check.ts),
// each judged by src/lib/formula/field.ts, as the question editor's are.
// A back image's rules (cardImageProblem) are in card-rules.ts, which has no
// dependencies, as the upload seam's shared rules need.
// The import planner (src/lib/content-import/plan.ts) applies the same limits
// and the same formula check to each CSV row.
// ─────────────────────────────────────────────────────────────────────────────

/** A card's text fields. */
export type CardField = keyof typeof CARD_TEXT_LIMITS;

/** A card's text as the form holds it: the note is "" when there's none. */
export interface CardText {
  front: string;
  back: string;
  note: string;
}

export const ADD_A_FRONT = "ADD A FRONT TO SAVE";
export const ADD_A_BACK = "ADD A BACK TO SAVE";

const REQUIRED: Partial<Record<CardField, string>> = { front: ADD_A_FRONT, back: ADD_A_BACK };

/** Pure: why one field's text can't be saved, or null when it can. */
export const cardFieldProblem = (field: CardField, text: string): string | null =>
  formulaFieldProblem(text, {
    name: `The ${field}`,
    limit: CARD_TEXT_LIMITS[field],
    blank: REQUIRED[field] ?? null,
  });

/** Pure: each field that can't be saved, with why. Empty when the card can be saved. */
export function cardFieldProblems(card: CardText): Partial<Record<CardField, string>> {
  const problems: Partial<Record<CardField, string>> = {};
  for (const field of Object.keys(CARD_TEXT_LIMITS) as CardField[]) {
    const problem = cardFieldProblem(field, card[field]);
    if (problem) problems[field] = problem;
  }
  return problems;
}

/** Pure: a card's text as saved: each field trimmed, and a blank note as none. */
export function cardFieldsOf(card: CardText): { front: string; back: string; note: string | null } {
  const note = card.note.trim();
  return { front: card.front.trim(), back: card.back.trim(), note: note === "" ? null : note };
}
