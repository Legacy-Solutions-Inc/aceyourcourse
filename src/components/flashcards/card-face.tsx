import { FormulaText } from "@/components/formula/formula-text";
import { cn } from "@/lib/utils";
import { watermarkBackground } from "@/lib/watermark";

interface CardFaceProps {
  side: "front" | "back";
  /** The label over the face, e.g. "MSTC · SIMPLE CURVES". */
  label: string;
  /** The face's text, in the formula notation. */
  text: string;
  /** The back's note, in the formula notation. */
  note?: string | null;
  /** The back's image: where the browser loads it from, or null. */
  imageSrc?: string | null;
  /** Shown while the face has no text yet, e.g. in an empty form. */
  placeholder?: string;
  /** The viewer's email, tiled faintly across the face as Members see theirs. */
  watermark?: string;
  className?: string;
}

/**
 * One face of a flashcard as Members see it (mockup `flashcards`; BUILD-MAP
 * §Flashcards): a 3:2 card with its label and side, the text with its maths
 * rendered and, on the back, the image and the note. A face with more text
 * than fits grows taller rather than scrolling inside itself, so nothing on
 * it is out of the keyboard's reach. The card editor's
 * preview (ticket 07) shows each face with it; the Member App's deck player
 * (ticket 08) adds flipping and marking around it. The watermark is a
 * picture behind the text (src/lib/watermark.ts), never text in the page.
 */
export function CardFace({
  side,
  label,
  text,
  note = null,
  imageSrc = null,
  placeholder = "",
  watermark,
  className,
}: CardFaceProps) {
  return (
    <figure
      aria-label={`Card ${side}`}
      className={cn(
        "relative flex aspect-[3/2] min-w-0 flex-col gap-2 border-[1.5px] bg-white p-4 shadow-[3px_3px_0_var(--ayc-navy)]",
        className,
      )}
    >
      <figcaption className="flex justify-between gap-2 font-mono text-[10px] font-bold tracking-[0.06em] text-muted-foreground">
        <span className="truncate">{label}</span>
        <span>{side.toUpperCase()}</span>
      </figcaption>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        {text ? (
          <FormulaText
            text={text}
            className={side === "front" ? "text-lg font-bold" : "text-base"}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        )}
        {imageSrc ? (
          // A private image the browser already holds (an object URL) or reads
          // through the Admin's Staff-only route: not for next/image's optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt="Image on the back of the card"
            className="max-h-28 max-w-full object-contain"
          />
        ) : null}
      </div>
      {watermark ? (
        <div
          aria-hidden="true"
          data-watermark=""
          className="pointer-events-none absolute inset-0 select-none"
          style={{ backgroundImage: watermarkBackground(watermark) }}
        />
      ) : null}
      {note ? (
        <p className="border-t border-ayc-ruled pt-1.5 text-xs text-muted-foreground">
          <FormulaText text={note} />
        </p>
      ) : null}
    </figure>
  );
}
