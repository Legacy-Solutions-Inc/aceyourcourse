// ─────────────────────────────────────────────────────────────────────────────
// The stamp burned into each Reviewer PDF page a Member reads (Phase 3,
// ticket 14; spec, Phase 3 → Burned-in watermark, and Phase 3 planning
// decisions → Watermark stamping), pure. The protected page endpoint stamps
// every page on every request, after the access decision, with the Member's
// email and short Member ID (src/lib/member-app/member-id.ts), through the
// page stamper (src/services/page-images.sharp.ts), which draws it as this
// layout says.
//
// The stamp is a few rows of the text repeated across the page, every other
// row offset by half a repeat, so the rows tile like bricks: semi-transparent,
// so the page reads through it, and in the same place on every page of a
// given size, so it can be tested. A row runs the full width every sixth of
// the page, so no strip of the page can be cut out without one.
// ─────────────────────────────────────────────────────────────────────────────

/** What a page is stamped with: the Member's email and short Member ID. */
export interface PageStamp {
  email: string;
  memberId: string;
}

/**
 * The font the stamp is drawn in, from the app's folder: Liberation Sans Bold
 * (SIL Open Font License), which pdf.js ships (pdfjs-dist is a dependency).
 * A server has no fonts of its own; next.config.ts sends this one with the
 * page endpoint.
 */
export const STAMP_FONT_PATH = "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf";

/** How many rows of the stamp each page carries. */
export const STAMP_ROWS = 6;

/** The stamp's colour, AYC navy, and how opaque its text is. */
export const STAMP_COLOUR = { r: 0x14, g: 0x21, b: 0x3d } as const;
export const STAMP_OPACITY = 0.24;

/** The text size, in pixels, relative to the page's width (a 1600 px page gets 33 px)… */
const WIDTH_PER_FONT_PX = 48;
/** …within these bounds, so a small page's stamp stays readable and a huge one's stays modest. */
const MIN_FONT_PX = 10;
const MAX_FONT_PX = 40;

/** Where the stamp's rows go on a page of one size. */
export interface StampLayout {
  /** The text's size, in pixels. */
  fontPx: number;
  /** Each row's height: the text is drawn inside it, never taller. */
  lineHeight: number;
  /** The space between one repeat of the text and the next along a row. */
  gap: number;
  /** Each row's top edge, from the top of the page, top row first: STAMP_ROWS of them. */
  rowTops: number[];
}

/** Pure: the stamp's text, as every row repeats it. */
export const stampText = ({ email, memberId }: PageStamp) => `${email} · ${memberId}`;

/** Pure: text as the text renderer (Pango) reads it literally: it would read `<` and `&` as markup. */
export const pangoText = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

/** Pure: where the stamp goes on a page this many pixels wide and high. */
export function stampLayout(width: number, height: number): StampLayout {
  const fontPx = Math.min(
    MAX_FONT_PX,
    Math.max(MIN_FONT_PX, Math.round(width / WIDTH_PER_FONT_PX)),
  );
  const lineHeight = Math.ceil(fontPx * 1.4);
  // Each row is centred in its sixth of the page.
  const rowTops = Array.from({ length: STAMP_ROWS }, (_, row) =>
    Math.round((height * (2 * row + 1)) / (2 * STAMP_ROWS) - lineHeight / 2),
  );
  return { fontPx, lineHeight, gap: fontPx * 3, rowTops };
}
