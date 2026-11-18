import { CARD_TEXT_LIMITS, matchingFront } from "@/lib/cards/card-rules";

import {
  type ExistingTopic,
  type ImportRows,
  type ImportPlan,
  type PlanInput,
  planImport,
  readTextCells,
} from "./plan";

// ─────────────────────────────────────────────────────────────────────────────
// The card import's rows (Phase 3, ticket 06; stories 118, 120–124, 133p):
// one flashcard per row, with its Topic, front, back, an optional note (each
// in the formula notation) and an optional back image in the zip. Replace
// matches a card by its front (trimmed, single spaces, case kept), so a card
// whose front is unchanged keeps its id, and every Member's Card Mark on it.
// The planner itself (plan.ts) is shared with the quiz import.
// ─────────────────────────────────────────────────────────────────────────────

/** The card template's columns, in its order. */
export const CARD_IMPORT_COLUMNS = ["topic", "front", "back", "note", "image"] as const;

/** A card's own fields. */
export interface CardFields {
  front: string;
  back: string;
  note: string | null;
}

export type ExistingCardTopic = ExistingTopic<CardFields>;

export const CARD_IMPORT: ImportRows<CardFields> = {
  columns: CARD_IMPORT_COLUMNS,
  fileColumn: "image",
  item: { one: "card", many: "cards" },
  files: "images",
  read(cell) {
    const { text, problems } = readTextCells(cell, {
      front: { required: true, limit: CARD_TEXT_LIMITS.front },
      back: { required: true, limit: CARD_TEXT_LIMITS.back },
      note: { required: false, limit: CARD_TEXT_LIMITS.note },
    });
    const { front, back, note = null } = text;
    const fields = problems.length === 0 && front && back ? { front, back, note } : null;
    return { fields, problems };
  },
  matchKey: ({ front }) => matchingFront(front),
  sameFields: (a, b) => a.front === b.front && a.back === b.back && a.note === b.note,
};

/** Pure: a card import's plan and problems (plan.ts). */
export const planCardImport = (input: PlanInput<CardFields>): ImportPlan<CardFields> =>
  planImport(CARD_IMPORT, input);
