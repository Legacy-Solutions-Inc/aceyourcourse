import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import sharp from "sharp";

import type { ImportError } from "./rows";

// ─────────────────────────────────────────────────────────────────────────────
// Product photos for the catalogue import. Photos are self-hosted, never
// hot-linked: a photo the client sends (a file in the spreadsheet's photos/
// folder) is optimised into public/products/{slug}/{n}.webp, and a /products/…
// path already in public/ is kept as it is.
// ─────────────────────────────────────────────────────────────────────────────

/** One photo a Product lists, in its place in the gallery. */
export interface PhotoJob {
  slug: string;
  /** The products.csv row that lists it. */
  row: number;
  /** As typed: a file in the photos folder, or a /products/… path to keep. */
  ref: string;
  /** Where the Website serves it. */
  src: string;
}

/**
 * Pure: where a Product's photo at this place (1 is the cover) is served. A
 * path is kept as typed; a file is optimised into /products/{slug}/{n}.webp.
 */
export function photoSrc(slug: string, position: number, ref: string): string {
  return ref.startsWith("/") ? ref : `/products/${slug}/${position}.webp`;
}

/** The size budget for each optimised photo: its longest side, and its file size. */
export const PHOTO_MAX_SIDE = 1200;
export const PHOTO_MAX_BYTES = 200 * 1024;

/** WebP qualities tried in turn, until the photo fits PHOTO_MAX_BYTES. */
const QUALITIES = [80, 70, 60, 50, 40, 30];

export interface PhotoDirs {
  /** The spreadsheet's photos/ folder. */
  photosDir: string;
  publicDir: string;
  /** A temp folder the optimised photos are written to first. */
  stagingDir: string;
}

/** An optimised photo, waiting in the staging folder to be published at its src. */
export interface StagedPhoto {
  src: string;
  file: string;
}

export interface StagedPhotos {
  /** How many /products/… paths were kept as they are. */
  kept: number;
  staged: StagedPhoto[];
  errors: ImportError[];
}

/** A path under public/products/, with no way out of it. */
const isProductsPath = (ref: string) =>
  ref.startsWith("/products/") &&
  !ref.includes("\\") &&
  ref
    .split("/")
    .slice(1)
    .every((part) => part !== "" && part !== "." && part !== "..");

/** A plain file name, so a photo can only come from the photos folder itself. */
const isFileName = (ref: string) => !/[/\\]/.test(ref) && ref !== "." && ref !== "..";

async function isFile(path: string): Promise<boolean> {
  const found = await stat(path).catch(() => null);
  return found?.isFile() ?? false;
}

type Optimised = { ok: true; webp: Buffer } | { ok: false; problem: string };

/** The photo as a WebP within the budget, at the highest quality tried that fits. */
async function optimise(file: string): Promise<Optimised> {
  const resized = sharp(file)
    .rotate() // upright, as the camera's orientation tag says
    .resize({
      width: PHOTO_MAX_SIDE,
      height: PHOTO_MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    });
  try {
    for (const quality of QUALITIES) {
      const webp = await resized.clone().webp({ quality }).toBuffer();
      if (webp.length <= PHOTO_MAX_BYTES) return { ok: true, webp };
    }
  } catch {
    return { ok: false, problem: "can't be read as an image" };
  }
  return {
    ok: false,
    problem: `can't be brought under ${PHOTO_MAX_BYTES / 1024} KB; send a smaller or simpler photo`,
  };
}

/**
 * Checks every photo and optimises each file into the staging folder. Nothing
 * is written to public/: publishPhotos does that, once the whole import is
 * known to be good. Every problem is reported at its products.csv row.
 */
export async function stagePhotos(jobs: PhotoJob[], dirs: PhotoDirs): Promise<StagedPhotos> {
  const result: StagedPhotos = { kept: 0, staged: [], errors: [] };
  const problem = ({ row, ref }: PhotoJob, message: string) =>
    result.errors.push({
      sheet: "products",
      row,
      column: "photos",
      message: `photo "${ref}" ${message}`,
    });

  const keptAt = new Map(
    jobs.filter((job) => job.ref.startsWith("/")).map((job) => [job.src, job.row]),
  );

  for (const job of jobs) {
    if (isProductsPath(job.ref)) {
      if (await isFile(join(dirs.publicDir, job.ref))) result.kept += 1;
      else problem(job, "isn't in public/");
      continue;
    }
    if (!isFileName(job.ref)) {
      problem(job, "must be a file name in the photos folder or a /products/… path");
      continue;
    }
    const keptRow = keptAt.get(job.src);
    if (keptRow !== undefined) {
      problem(job, `would replace ${job.src}, which products.csv row ${keptRow} still lists`);
      continue;
    }

    const source = join(dirs.photosDir, job.ref);
    if (!(await isFile(source))) {
      problem(job, "isn't in the photos folder");
      continue;
    }
    const optimised = await optimise(source);
    if (!optimised.ok) {
      problem(job, optimised.problem);
      continue;
    }
    const file = join(dirs.stagingDir, job.src);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, optimised.webp);
    result.staged.push({ src: job.src, file });
  }
  return result;
}

/** Copies the staged photos into public/, each at its src. */
export async function publishPhotos(staged: StagedPhoto[], publicDir: string): Promise<void> {
  for (const { src, file } of staged) {
    const target = join(publicDir, src);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
  }
}
