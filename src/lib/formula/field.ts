import { textLength } from "@/lib/cards/card-rules";

import { formulaProblem } from "./check";

// ─────────────────────────────────────────────────────────────────────────────
// One text field in the formula notation, as the Admin's content editors
// judge it (Phase 3: the card editor, ticket 07; the question editor, ticket
// 10), pure, so the browser checks it before saving and the Admin seam checks
// it again: blank when it's required, over its length as Postgres counts
// characters, or a formula that won't render, each judged on the text as
// saved (trimmed). card-fields.ts and question-fields.ts give each field its
// rule.
// ─────────────────────────────────────────────────────────────────────────────

/** How one text field in the formula notation is judged. */
export interface FormulaFieldRule {
  /** What the field is called at the start of a formula's message, e.g. "The front". */
  name: string;
  /** The longest it may be, in characters. */
  limit: number;
  /** What a blank field is told, or null when it may be blank. */
  blank: string | null;
}

/** Pure: "KEEP IT TO 2,000 CHARACTERS". */
export const keepItTo = (limit: number) => `KEEP IT TO ${limit.toLocaleString("en")} CHARACTERS`;

/** Pure: why one text field can't be saved, or null when it can. */
export function formulaFieldProblem(text: string, rule: FormulaFieldRule): string | null {
  const value = text.trim();
  if (value === "") return rule.blank;
  if (textLength(value) > rule.limit) return keepItTo(rule.limit);
  const formula = formulaProblem(value);
  return formula ? `${rule.name} ${formula}` : null;
}
