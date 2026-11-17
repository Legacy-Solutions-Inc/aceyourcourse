import katex, { type KatexOptions } from "katex";

import { splitFormula } from "./formula";

// ─────────────────────────────────────────────────────────────────────────────
// Whether text in the formula notation renders (spec, Phase 3 planning
// decisions → Formula notation in every text field). Each formula goes
// through KaTeX with the options the Member App and the card editor render
// with, so what passes here renders there. A formula KaTeX can't parse is
// reported, never thrown.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How every formula is rendered. throwOnError makes a parse error an error
 * rather than red text; trust stays off, so \href, \url and \includegraphics
 * never become links or images; maxExpand stops a macro from looping.
 */
export const KATEX_OPTIONS = {
  throwOnError: true,
  strict: "ignore",
  trust: false,
  maxExpand: 1000,
} as const satisfies KatexOptions;

/** The longest piece of a formula a message quotes. */
const QUOTE_LIMIT = 40;

const quote = (tex: string) =>
  `“${tex.length > QUOTE_LIMIT ? `${tex.slice(0, QUOTE_LIMIT)}…` : tex}”`;

/** KaTeX's own reason, without its "KaTeX parse error:" prefix and position marks. */
function reasonOf(error: unknown): string {
  if (error instanceof katex.ParseError) return error.rawMessage;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Pure: why the text won't render, or null when it will: notation that can't
 * be read (a $ never closed, an empty formula), or the first formula KaTeX
 * can't parse, quoted with KaTeX's reason.
 */
export function formulaProblem(text: string): string | null {
  const split = splitFormula(text);
  if (!split.ok) return split.problem;
  for (const segment of split.segments) {
    if (segment.kind !== "math") continue;
    try {
      katex.renderToString(segment.tex, { ...KATEX_OPTIONS, displayMode: segment.display });
    } catch (error) {
      return `has a formula that won’t render, ${quote(segment.tex)}: ${reasonOf(error)}`;
    }
  }
  return null;
}
