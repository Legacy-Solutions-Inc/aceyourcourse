import "server-only";

import { join } from "node:path";

import sharp from "sharp";

import { PAGE_WEBP_QUALITY } from "@/lib/reviewer-pdfs/job";
import {
  pangoText,
  STAMP_COLOUR,
  STAMP_FONT_PATH,
  STAMP_OPACITY,
  type StampLayout,
  stampLayout,
  stampText,
} from "@/lib/reviewer-pdfs/stamp";
import type { PageStamper } from "@/services/page-images.types";

// ─────────────────────────────────────────────────────────────────────────────
// The real page stamper (Phase 3, ticket 14; spec, Phase 3 → Burned-in
// watermark): sharp draws the stamp's text and burns its rows into the page
// (the layout is src/lib/reviewer-pdfs/stamp.ts), then encodes the page as
// WebP again. It runs on every page request, after the access decision, and
// keeps nothing: no stamped copy is stored anywhere.
//
// A server (Vercel's above all) has no fonts of its own, so the text is drawn
// with a font file named outright (STAMP_FONT_PATH, src/lib/reviewer-pdfs/
// stamp.ts), which goes with the page endpoint through
// outputFileTracingIncludes (next.config.ts).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The font file the stamp is drawn in (STAMP_FONT_PATH), and its family name.
 * It's found from the app's folder, where file tracing puts it: a bundler
 * turns a package lookup (require.resolve) into a module number, not a path.
 */
export const STAMP_FONT_FILE = join(process.cwd(), STAMP_FONT_PATH);
const STAMP_FONT = "Liberation Sans Bold";

/** The stamp's text drawn once: how much of each pixel the letters cover, 0 to 255. */
interface TextMask {
  coverage: Buffer;
  width: number;
  height: number;
}

async function drawText(text: string, fontPx: number): Promise<TextMask> {
  const { data, info } = await sharp({
    text: {
      text: pangoText(text),
      font: `${STAMP_FONT} ${fontPx}`,
      fontfile: STAMP_FONT_FILE,
      // At 72 dpi a point is a pixel, so the font's size is fontPx pixels.
      dpi: 72,
    },
  })
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { coverage: data, width: info.width, height: info.height };
}

/**
 * One row of the stamp, as an RGBA strip the page's width: the text repeated
 * along it from `start`, centred in the row's height, cut to the rows `from`
 * to `to` of the row that fall on the page.
 */
function rowStrip(
  text: TextMask,
  { width, lineHeight, gap }: Pick<StampLayout, "lineHeight" | "gap"> & { width: number },
  start: number,
  from: number,
  to: number,
): Buffer {
  const strip = Buffer.alloc(width * (to - from) * 4);
  const shown = Math.min(text.height, lineHeight);
  const textTop = Math.floor((lineHeight - shown) / 2);
  const { r, g, b } = STAMP_COLOUR;
  for (let left = start; left < width; left += text.width + gap) {
    for (let ty = 0; ty < shown; ty += 1) {
      const y = textTop + ty;
      if (y < from || y >= to) continue;
      for (let tx = 0; tx < text.width; tx += 1) {
        const x = left + tx;
        const coverage = text.coverage[ty * text.width + tx] ?? 0;
        if (x < 0 || x >= width || coverage === 0) continue;
        const at = ((y - from) * width + x) * 4;
        strip[at] = r;
        strip[at + 1] = g;
        strip[at + 2] = b;
        strip[at + 3] = Math.round(coverage * STAMP_OPACITY);
      }
    }
  }
  return strip;
}

export const sharpStamper: PageStamper = {
  async stamp(image, stamp) {
    const page = sharp(image);
    const { width, height } = await page.metadata();
    if (!width || !height) throw new Error("The page image has no size.");
    const layout = stampLayout(width, height);
    const text = await drawText(stampText(stamp), layout.fontPx);
    const repeat = text.width + layout.gap;

    // Each row, cut to the part of it on the page, every other one offset by half a repeat.
    const rows = layout.rowTops.flatMap((top, row) => {
      const from = Math.max(0, -top);
      const to = Math.min(layout.lineHeight, height - top);
      if (to <= from) return [];
      const start = row % 2 === 0 ? 0 : -Math.round(repeat / 2);
      return [
        {
          input: rowStrip(text, { ...layout, width }, start, from, to),
          raw: { width, height: to - from, channels: 4 as const },
          left: 0,
          top: top + from,
        },
      ];
    });

    const stamped = await page
      // A page with transparency reads as on white paper.
      .flatten({ background: "#ffffff" })
      .composite(rows)
      .removeAlpha()
      .webp({ quality: PAGE_WEBP_QUALITY })
      .toBuffer();
    return new Uint8Array(stamped);
  },
};
