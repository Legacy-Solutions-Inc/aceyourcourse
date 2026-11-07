// @vitest-environment node
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type PhotoDirs,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_SIDE,
  type PhotoJob,
  photoSrc,
  publishPhotos,
  stagePhotos,
} from "./photos";

// Product photos: a file the client sends is optimised into a self-hosted
// WebP within the size budget, and a /products/… path already in public/ is
// kept. Everything is staged in a temp folder first; public/ only changes when
// the staged photos are published.

let root: string;
let dirs: PhotoDirs;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ayc-photos-"));
  dirs = {
    photosDir: join(root, "spreadsheet", "photos"),
    publicDir: join(root, "public"),
    stagingDir: join(root, "staging"),
  };
  await mkdir(dirs.photosDir, { recursive: true });
  await mkdir(join(dirs.publicDir, "products", "ce-cards"), { recursive: true });
  await mkdir(dirs.stagingDir);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Pseudo-random bytes from a fixed seed (mulberry32), so every run makes the same photo. */
function noise(length: number, seed = 12): Buffer {
  const bytes = Buffer.alloc(length);
  let state = seed;
  for (let index = 0; index < length; index += 1) {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    bytes[index] = (mixed ^ (mixed >>> 14)) & 0xff;
  }
  return bytes;
}

/** A JPEG of noise: as hard to compress as a photo gets. */
async function noisePhoto(name: string, width: number, height: number) {
  await sharp(noise(width * height * 3), { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toFile(join(dirs.photosDir, name));
}

const job = (ref: string, position = 1, slug = "ce-cards"): PhotoJob => ({
  slug,
  row: 2,
  ref,
  src: photoSrc(slug, position, ref),
});

describe("stagePhotos", () => {
  it("optimises each file into a WebP within 1200 px and 200 KB, lowering quality as needed", async () => {
    // 3000 × 2000 of noise is far over 200 KB at quality 80, even at 1200 px.
    await noisePhoto("cover.jpg", 3000, 2000);
    await noisePhoto("back.jpg", 400, 300);

    const result = await stagePhotos([job("cover.jpg", 1), job("back.jpg", 2)], dirs);

    expect(result.errors).toEqual([]);
    expect(result.kept).toBe(0);
    expect(result.staged.map((photo) => photo.src)).toEqual([
      "/products/ce-cards/1.webp",
      "/products/ce-cards/2.webp",
    ]);
    const [cover, back] = await Promise.all(
      result.staged.map(async (photo) => ({
        meta: await sharp(photo.file).metadata(),
        bytes: (await stat(photo.file)).size,
      })),
    );
    expect(cover?.meta).toMatchObject({ format: "webp", width: PHOTO_MAX_SIDE, height: 800 });
    expect(cover?.bytes).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
    // A small photo is never enlarged.
    expect(back?.meta).toMatchObject({ format: "webp", width: 400, height: 300 });
  });

  it("keeps a /products/… path that is in public/, and writes nothing for it", async () => {
    await writeFile(join(dirs.publicDir, "products", "ce-cards", "1.webp"), "webp");

    const result = await stagePhotos([job("/products/ce-cards/1.webp")], dirs);

    expect(result).toEqual({ kept: 1, staged: [], errors: [] });
  });

  it("writes only into the staging folder, never into public/", async () => {
    await noisePhoto("cover.jpg", 200, 200);

    await stagePhotos([job("cover.jpg")], dirs);

    expect(await readdir(join(dirs.publicDir, "products", "ce-cards"))).toEqual([]);
  });

  it("reports each missing or unusable photo at its products.csv row, all in one run", async () => {
    await writeFile(join(dirs.photosDir, "notes.jpg"), "not an image");

    const result = await stagePhotos(
      [
        job("cover.jpg"),
        job("notes.jpg", 2),
        job("/products/ce-cards/9.webp", 3),
        job("/images/logo.png", 4),
        job("/products/../.env", 5),
        job("shoot/cover.jpg", 6),
      ],
      dirs,
    );

    expect(result.staged).toEqual([]);
    expect(result.errors).toEqual([
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message: 'photo "cover.jpg" isn\'t in the photos folder',
      },
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message: 'photo "notes.jpg" can\'t be read as an image',
      },
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message: 'photo "/products/ce-cards/9.webp" isn\'t in public/',
      },
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message:
          'photo "/images/logo.png" must be a file name in the photos folder or a /products/… path',
      },
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message:
          'photo "/products/../.env" must be a file name in the photos folder or a /products/… path',
      },
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message:
          'photo "shoot/cover.jpg" must be a file name in the photos folder or a /products/… path',
      },
    ]);
  });

  it("reports a photo too detailed to fit the size budget", async () => {
    // 1200 × 1200 of noise stays over 200 KB at every quality tried.
    await noisePhoto("cover.jpg", PHOTO_MAX_SIDE, PHOTO_MAX_SIDE);

    const result = await stagePhotos([job("cover.jpg")], dirs);

    expect(result.errors).toEqual([
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message:
          'photo "cover.jpg" can\'t be brought under 200 KB; send a smaller or simpler photo',
      },
    ]);
  });

  it("refuses to write a photo over one another row still keeps", async () => {
    await noisePhoto("cover.jpg", 200, 200);
    await writeFile(join(dirs.publicDir, "products", "ce-cards", "1.webp"), "webp");

    const result = await stagePhotos(
      [job("cover.jpg", 1), { ...job("/products/ce-cards/1.webp", 2, "ce-bundle"), row: 5 }],
      dirs,
    );

    expect(result.errors).toEqual([
      {
        sheet: "products",
        row: 2,
        column: "photos",
        message:
          'photo "cover.jpg" would replace /products/ce-cards/1.webp, which products.csv row 5 still lists',
      },
    ]);
  });
});

describe("publishPhotos", () => {
  it("copies the staged photos into public/ at their paths", async () => {
    await noisePhoto("cover.jpg", 200, 200);
    const { staged } = await stagePhotos([job("cover.jpg", 1, "me-cards")], dirs);

    await publishPhotos(staged, dirs.publicDir);

    const written = await sharp(join(dirs.publicDir, "products", "me-cards", "1.webp")).metadata();
    expect(written.format).toBe("webp");
  });
});
