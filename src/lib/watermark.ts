// ─────────────────────────────────────────────────────────────────────────────
// The overlay watermark (spec, Phase 3 → Burned-in watermark, the overlay
// part; mockup `flashcards`): the viewer's email tiled diagonally and faintly
// across a card. It's a background picture, never text in the page, so it
// can't be selected, copied or read out, and the page's own text keeps its
// contrast. The card editor's preview (ticket 07) shows the Staff User's own;
// the Member App's deck player (ticket 08) shows the Member's.
// ─────────────────────────────────────────────────────────────────────────────

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Pure: a CSS background-image that tiles `text` across what it's on, dark
 * and faint unless told otherwise (the sample video player draws it light, on
 * its dark frame).
 */
export function watermarkBackground(
  text: string,
  { fill = "#0e1a2e", opacity = 0.13 }: { fill?: string; opacity?: number } = {},
): string {
  const escaped = text.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120">` +
    `<text x="120" y="64" text-anchor="middle" transform="rotate(-24 120 60)" ` +
    `font-family="monospace" font-size="12" fill="${fill}" fill-opacity="${opacity}">${escaped}</text>` +
    `</svg>`;
  // encodeURIComponent leaves ( ) ' unencoded: encode them too, so nothing ends the url().
  const encoded = encodeURIComponent(svg).replace(
    /[()']/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `url("data:image/svg+xml,${encoded}")`;
}
