// ─────────────────────────────────────────────────────────────────────────────
// The formula notation (spec, Phase 3 planning decisions → Formula notation in
// every text field): card and quiz text is plain text with maths in $...$
// (inline) or $$...$$ (on its own line), and a literal dollar sign is written
// \$. This splitter is pure and has no dependencies, so the Member App, the
// card editor's live preview and the import planner all read the notation the
// same way; check.ts asks KaTeX whether each formula renders.
// ─────────────────────────────────────────────────────────────────────────────

/** A run of plain text, or one formula: inline ($...$) or on its own line ($$...$$). */
export type FormulaSegment =
  { kind: "text"; text: string } | { kind: "math"; tex: string; display: boolean };

/** The text's segments in order, or why the notation can't be read. */
export type FormulaSplit =
  { ok: true; segments: FormulaSegment[] } | { ok: false; problem: string };

export const UNCLOSED_INLINE = "has a $ with no closing $ (write a dollar sign as \\$)";
export const UNCLOSED_BLOCK = "has a $$ with no closing $$";
export const EMPTY_FORMULA = "has an empty formula";

/**
 * Where the formula opened at `start` closes: the index of its closing
 * delimiter, or -1 when it never closes. Inside maths a backslash escapes the
 * next character, so \$ is the renderer's dollar sign and doesn't close it.
 */
function closingAt(text: string, start: number, delimiter: "$" | "$$"): number {
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "\\") {
      index += 1;
      continue;
    }
    if (text.startsWith(delimiter, index)) return index;
  }
  return -1;
}

/**
 * Pure: the text's plain runs and formulas, in order. Outside maths only \$
 * is an escape (a literal dollar sign); any other backslash is kept as typed.
 * A formula that never closes, or has nothing in it, can't be read.
 */
export function splitFormula(text: string): FormulaSplit {
  const segments: FormulaSegment[] = [];
  let plain = "";
  const flush = () => {
    if (plain !== "") segments.push({ kind: "text", text: plain });
    plain = "";
  };

  let index = 0;
  while (index < text.length) {
    if (text.startsWith("\\$", index)) {
      plain += "$";
      index += 2;
      continue;
    }
    if (text[index] !== "$") {
      plain += text[index];
      index += 1;
      continue;
    }
    const display = text.startsWith("$$", index);
    const delimiter = display ? "$$" : "$";
    const start = index + delimiter.length;
    const end = closingAt(text, start, delimiter);
    if (end === -1) return { ok: false, problem: display ? UNCLOSED_BLOCK : UNCLOSED_INLINE };
    const tex = text.slice(start, end);
    if (tex.trim() === "") return { ok: false, problem: EMPTY_FORMULA };
    flush();
    segments.push({ kind: "math", tex, display });
    index = end + delimiter.length;
  }
  flush();
  return { ok: true, segments };
}
