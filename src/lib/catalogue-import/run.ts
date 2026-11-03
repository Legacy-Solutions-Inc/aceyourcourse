import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { convertSpreadsheet, type HandMaintained, sortErrors } from "./build";
import { publishPhotos, stagePhotos } from "./photos";
import { type ImportError, type SheetName, SHEETS } from "./rows";
import { SEED_MODULE_PATH, writeSeedModule } from "./write";

// ─────────────────────────────────────────────────────────────────────────────
// The catalogue import, end to end: read the spreadsheet folder, convert and
// check every row, and optimise the photos into a temp folder. Only when there
// are no errors at all are the photos published into public/ and the seed
// module written, so a spreadsheet with a problem changes nothing.
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportOptions {
  /** The spreadsheet folder: one CSV per sheet, and photos/ for the photo files. */
  dir: string;
  /** Only check: report what would be imported, and write nothing. */
  check: boolean;
  /** The Website settings, FAQs and Exam pages, kept by hand in code and checked with the rest. */
  handMaintained: HandMaintained;
  publicDir: string;
  seedModulePath?: string;
}

export interface ImportSummary {
  exams: number;
  subjects: number;
  products: { live: number; comingSoon: number };
  reviews: number;
  /** Photos kept at their /products/… path, and photo files optimised (or, in check mode, to optimise). */
  photos: { kept: number; optimised: number };
}

export type ImportResult =
  { ok: true; summary: ImportSummary } | { ok: false; errors: ImportError[] };

/** Each sheet's CSV text, or null when the folder doesn't have it. */
export async function readSpreadsheet(dir: string): Promise<Record<SheetName, string | null>> {
  const texts = await Promise.all(
    SHEETS.map((sheet) =>
      readFile(join(dir, `${sheet}.csv`), "utf8").catch((error: unknown) => {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
        throw error;
      }),
    ),
  );
  const [exams = null, subjects = null, products = null, variations = null, reviews = null] = texts;
  return { exams, subjects, products, variations, reviews };
}

/** Imports the spreadsheet in `dir`, or (with `check`) only checks it. */
export async function runImport({
  dir,
  check,
  handMaintained,
  publicDir,
  seedModulePath = SEED_MODULE_PATH,
}: ImportOptions): Promise<ImportResult> {
  const conversion = convertSpreadsheet(await readSpreadsheet(dir), handMaintained);

  const stagingDir = await mkdtemp(join(tmpdir(), "ayc-catalogue-import-"));
  try {
    const photos = await stagePhotos(conversion.photos, {
      photosDir: join(dir, "photos"),
      publicDir,
      stagingDir,
    });
    const errors = sortErrors([...conversion.errors, ...photos.errors]);
    if (errors.length > 0) return { ok: false, errors };

    if (!check) {
      await publishPhotos(photos.staged, publicDir);
      await writeSeedModule(conversion.catalogue, seedModulePath);
    }

    const { exams, products, reviews } = conversion.catalogue;
    return {
      ok: true,
      summary: {
        exams: exams.length,
        subjects: exams.reduce((total, exam) => total + exam.subjects.length, 0),
        products: {
          live: products.filter((product) => product.state === "live").length,
          comingSoon: products.filter((product) => product.state === "coming-soon").length,
        },
        reviews: reviews.length,
        photos: { kept: photos.kept, optimised: photos.staged.length },
      },
    };
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}

/** Pure: one error as the command prints it, e.g. `products.csv row 7, column exam_code: unknown Exam "XX"`. */
export function formatImportError({ sheet, row, column, message }: ImportError): string {
  if (sheet === null)
    return `settings, FAQs and Exam pages (src/services/mock/catalogue.ts): ${message}`;
  const where = [row === null ? null : `row ${row}`, column === null ? null : `column ${column}`]
    .filter((part) => part !== null)
    .join(", ");
  return `${sheet}.csv${where ? ` ${where}` : ""}: ${message}`;
}

/** Pure: what was imported (or, with `check`, would be), one line per kind. */
export function formatSummary(
  { exams, subjects, products, reviews, photos }: ImportSummary,
  check: boolean,
): string {
  return [
    `Exams     ${exams} (${subjects} Subjects)`,
    `Products  ${products.live + products.comingSoon} (${products.live} Live, ${products.comingSoon} Coming Soon)`,
    `Reviews   ${reviews}`,
    `Photos    ${photos.kept} kept, ${photos.optimised} ${check ? "to optimise" : "optimised"}`,
  ].join("\n");
}
