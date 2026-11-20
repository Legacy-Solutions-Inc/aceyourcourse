import { watermarkBackground } from "@/lib/watermark";

/**
 * The overlay watermark (spec, Phase 3 → Burned-in watermark, the overlay
 * part): the viewer's email tiled faintly over what it's placed in, which
 * needs `position: relative`. A background picture, never text in the page,
 * so it can't be selected or read out, and clicks pass through it. Cards
 * (ticket 07/08) and quizzes (ticket 11) wear it.
 */
export function WatermarkOverlay({ text }: { text: string }) {
  return (
    <div
      aria-hidden="true"
      data-watermark=""
      className="pointer-events-none absolute inset-0 select-none"
      style={{ backgroundImage: watermarkBackground(text) }}
    />
  );
}
