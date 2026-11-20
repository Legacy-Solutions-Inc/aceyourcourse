import "katex/dist/katex.min.css";

import { renderFormula } from "@/lib/formula/render";
import { cn } from "@/lib/utils";

interface FormulaTextProps {
  /** Text in the formula notation: maths in $...$ or $$...$$, a dollar sign as \$. */
  text: string;
  className?: string;
}

/**
 * Text in the formula notation, rendered as Members see it (spec, Phase 3
 * planning decisions → Formula notation in every text field): plain runs as
 * text, keeping line breaks, and each formula as KaTeX draws it. The card
 * editor's preview (ticket 07) and the Member App's cards (ticket 08) both
 * render with it. Text that won't render (only an unsaved form's can) shows
 * as typed; the form says why. No hooks, so a Server Component can use it too.
 */
export function FormulaText({ text, className }: FormulaTextProps) {
  const rendered = renderFormula(text);
  const style = cn("whitespace-pre-wrap wrap-anywhere", className);
  if (!rendered.ok) return <span className={style}>{text}</span>;
  return (
    <span className={style}>
      {rendered.parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          // KaTeX escapes the TeX and, with trust off, makes no links or
          // images (src/lib/formula/render.ts), so its markup is safe here.
          <span key={index} dangerouslySetInnerHTML={{ __html: part.html }} />
        ),
      )}
    </span>
  );
}
