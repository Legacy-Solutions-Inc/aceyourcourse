import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Upserts' ON CONFLICT … DO UPDATE SET, shared by the database arms that
// write content rows (the imports, ticket 06 and 09; the card and question
// editors, tickets 07 and 10): a row keeps its id, and so every Member's
// progress tied to it, while its other columns take the offered row's.
// ─────────────────────────────────────────────────────────────────────────────

/** One column of the row the upsert offered (Postgres's `excluded`), by its column name. */
export const fromExcluded = (column: string) => sql.raw(`excluded."${column}"`);

/**
 * A question's columns an upsert sets from the row it offered: all but its
 * id and its quiz. A question taken out of its quiz takes its cleared place
 * and its removed marker this way; one still in the quiz keeps no marker.
 */
export const QUESTION_UPSERT_SET = {
  position: fromExcluded("position"),
  question: fromExcluded("question"),
  choiceA: fromExcluded("choice_a"),
  choiceB: fromExcluded("choice_b"),
  choiceC: fromExcluded("choice_c"),
  choiceD: fromExcluded("choice_d"),
  correctChoice: fromExcluded("correct_choice"),
  explanation: fromExcluded("explanation"),
  figurePath: fromExcluded("figure_path"),
  removedAt: fromExcluded("removed_at"),
};
