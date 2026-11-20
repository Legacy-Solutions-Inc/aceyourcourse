import katex from "katex";

import { formulaProblem, KATEX_OPTIONS } from "./check";
import { splitFormula } from "./formula";

// ─────────────────────────────────────────────────────────────────────────────
// Text in the formula notation, rendered (spec, Phase 3 planning decisions →
// Formula notation in every text field): each plain run stays text, and each
// formula becomes KaTeX's HTML, with the options check.ts judges it by, so
// what passes the check renders here. Pure, with no React, so the card
// editor's live preview (ticket 07) and the Member App's cards (ticket 08)
// render a card the same way through <FormulaText>.
//
// KaTeX escapes the TeX it's given and, with trust off, never makes a link or
// an image, so its HTML is safe to put in the page.
// ─────────────────────────────────────────────────────────────────────────────

/** A run of plain text, or one formula's HTML: inline, or on its own line. */
export type RenderedPart =
  { kind: "text"; text: string } | { kind: "math"; html: string; display: boolean };

/** The text's parts in order, or why it won't render. */
export type RenderedFormula = { ok: true; parts: RenderedPart[] } | { ok: false; problem: string };

/** Pure: the text's parts, rendered, or why it won't render (never a throw). */
export function renderFormula(text: string): RenderedFormula {
  const problem = formulaProblem(text);
  if (problem) return { ok: false, problem };
  const split = splitFormula(text);
  // formulaProblem read the notation first, so this can't fail.
  if (!split.ok) return { ok: false, problem: split.problem };
  return {
    ok: true,
    parts: split.segments.map((segment) =>
      segment.kind === "text"
        ? segment
        : {
            kind: "math",
            html: katex.renderToString(segment.tex, {
              ...KATEX_OPTIONS,
              displayMode: segment.display,
            }),
            display: segment.display,
          },
    ),
  };
}
