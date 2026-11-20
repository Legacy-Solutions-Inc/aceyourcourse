import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { PAGE_WIDTH } from "@/lib/reviewer-pdfs/job";
import { type PageStamp, stampLayout } from "@/lib/reviewer-pdfs/stamp";
import { FAKE_PAGE_IMAGE } from "@/services/page-images.fake";
import { sharpStamper } from "@/services/page-images.sharp";

// The real page stamper (ticket 14; spec, Testing Decisions → Page images):
// sharp burns a Member's email and short Member ID into a page, on tiny pages
// drawn here: white paper with a black block of "text" across its middle.

const TESTER: PageStamp = { email: "tester@example.com", memberId: "3F1A5C2E" };
const LAPSED: PageStamp = { email: "lapsed@example.com", memberId: "9C04D7B1" };

const WIDTH = 320;
const HEIGHT = 414;
/** The black block: the page's content, from a quarter to three quarters of the way across and down. */
const BLOCK = { left: 80, top: 104, width: 160, height: 206 };
/** How far lossy WebP's re-encoding may move a pixel away from the stamp. */
const TOLERANCE = 12;
/** The rows' edges blur a little in the encoding: pixels this close to a row count as in it. */
const EDGE = 3;

/** A page as the job stores one: a WebP, white with a black block. */
async function cleanPage(width = WIDTH, height = HEIGHT): Promise<Uint8Array> {
  const block = await sharp({
    create: { width: BLOCK.width, height: BLOCK.height, channels: 3, background: "#000000" },
  })
    .png()
    .toBuffer();
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
      .composite([{ input: block, left: BLOCK.left, top: BLOCK.top }])
      .webp({ lossless: true })
      .toBuffer(),
  );
}

interface Pixels {
  data: Buffer;
  width: number;
  height: number;
}

async function pixelsOf(image: Uint8Array): Promise<Pixels> {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(info.channels).toBe(3);
  return { data, width: info.width, height: info.height };
}

/** How far apart two pages are at one pixel: the largest difference in any channel. */
function difference(a: Pixels, b: Pixels, x: number, y: number): number {
  const at = (y * a.width + x) * 3;
  return Math.max(
    Math.abs((a.data[at] ?? 0) - (b.data[at] ?? 0)),
    Math.abs((a.data[at + 1] ?? 0) - (b.data[at + 1] ?? 0)),
    Math.abs((a.data[at + 2] ?? 0) - (b.data[at + 2] ?? 0)),
  );
}

/** The rows of a page this size that the stamp's rows cover, edges and all. */
function stampRows(width: number, height: number): Set<number> {
  const { rowTops, lineHeight } = stampLayout(width, height);
  const rows = new Set<number>();
  for (const top of rowTops) {
    for (let y = top - EDGE; y < top + lineHeight + EDGE; y += 1) rows.add(y);
  }
  return rows;
}

describe("sharpStamper", () => {
  let clean: Uint8Array;
  let stamped: Uint8Array;

  beforeAll(async () => {
    clean = await cleanPage();
    stamped = await sharpStamper.stamp(clean, TESTER);
  });

  it("gives a WebP the page's size, never the clean page", async () => {
    expect(await sharp(stamped).metadata()).toMatchObject({
      format: "webp",
      width: WIDTH,
      height: HEIGHT,
    });
    expect(Buffer.from(stamped).equals(Buffer.from(clean))).toBe(false);
  });

  it("changes the page in each of the stamp's rows, and nowhere else", async () => {
    const before = await pixelsOf(clean);
    const after = await pixelsOf(stamped);
    const covered = stampRows(WIDTH, HEIGHT);
    const { rowTops, lineHeight } = stampLayout(WIDTH, HEIGHT);

    for (const top of rowTops) {
      let changed = 0;
      for (let y = top; y < top + lineHeight; y += 1) {
        for (let x = 0; x < WIDTH; x += 1)
          if (difference(before, after, x, y) > TOLERANCE) changed++;
      }
      // The row's text marks a fair share of the band it runs along.
      expect(changed / (lineHeight * WIDTH)).toBeGreaterThan(0.04);
    }

    let outside = 0;
    for (let y = 0; y < HEIGHT; y += 1) {
      if (covered.has(y)) continue;
      for (let x = 0; x < WIDTH; x += 1) {
        outside = Math.max(outside, difference(before, after, x, y));
      }
    }
    expect(outside).toBeLessThanOrEqual(TOLERANCE);
  });

  it("is semi-transparent: white paper stays light under it, and black text stays black", async () => {
    const after = await pixelsOf(stamped);
    const { rowTops, lineHeight } = stampLayout(WIDTH, HEIGHT);
    let lightest = 255;
    let darkest = 0;
    for (const top of rowTops) {
      for (let y = top; y < top + lineHeight; y += 1) {
        for (let x = 0; x < WIDTH; x += 1) {
          const at = (y * WIDTH + x) * 3;
          const value = Math.min(
            after.data[at] ?? 0,
            after.data[at + 1] ?? 0,
            after.data[at + 2] ?? 0,
          );
          const inBlock =
            x >= BLOCK.left + EDGE &&
            x < BLOCK.left + BLOCK.width - EDGE &&
            y >= BLOCK.top + EDGE &&
            y < BLOCK.top + BLOCK.height - EDGE;
          const onPaper =
            x < BLOCK.left - EDGE ||
            x >= BLOCK.left + BLOCK.width + EDGE ||
            y < BLOCK.top - EDGE ||
            y >= BLOCK.top + BLOCK.height + EDGE;
          if (onPaper) lightest = Math.min(lightest, value);
          if (inBlock) darkest = Math.max(darkest, value);
        }
      }
    }
    // The stamp is there on the paper, and the paper still reads as paper…
    expect(lightest).toBeLessThan(240);
    expect(lightest).toBeGreaterThan(150);
    // …and the page's own text under it is still text.
    expect(darkest).toBeLessThan(40);
  });

  it("stamps each Member's page with their own details", async () => {
    const theirs = await pixelsOf(await sharpStamper.stamp(clean, LAPSED));
    const mine = await pixelsOf(stamped);
    const { rowTops, lineHeight } = stampLayout(WIDTH, HEIGHT);
    let differing = 0;
    for (let y = rowTops[0] ?? 0; y < (rowTops[0] ?? 0) + lineHeight; y += 1) {
      for (let x = 0; x < WIDTH; x += 1)
        if (difference(mine, theirs, x, y) > TOLERANCE) differing++;
    }
    expect(differing).toBeGreaterThan(50);
  });

  it("stamps the same page the same way every time", async () => {
    const again = await pixelsOf(await sharpStamper.stamp(clean, TESTER));
    const first = await pixelsOf(stamped);
    expect(again.data.equals(first.data)).toBe(true);
  });

  it("reads an email with markup characters as plain text", async () => {
    const odd = await sharpStamper.stamp(clean, {
      email: "a&b<i>@example.com",
      memberId: "3F1A5C2E",
    });
    expect(await sharp(odd).metadata()).toMatchObject({ format: "webp", width: WIDTH });
  });

  it("stamps the sample data's tiny page", async () => {
    const tiny = await sharpStamper.stamp(FAKE_PAGE_IMAGE, TESTER);
    expect(await sharp(tiny).metadata()).toMatchObject({ format: "webp", width: 16, height: 21 });
  });

  it("refuses bytes that aren't an image", async () => {
    await expect(
      sharpStamper.stamp(new TextEncoder().encode("not a page"), TESTER),
    ).rejects.toThrow();
  });

  it("stamps a full-size page quickly enough to do on every request", async () => {
    const full = await cleanPage(PAGE_WIDTH, 2071);
    await sharpStamper.stamp(full, TESTER);
    const started = performance.now();
    const page = await sharpStamper.stamp(full, LAPSED);
    const took = performance.now() - started;
    expect(await sharp(page).metadata()).toMatchObject({ width: PAGE_WIDTH, height: 2071 });
    expect(took).toBeLessThan(2000);
  });
});
