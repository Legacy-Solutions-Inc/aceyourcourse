// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { convertSpreadsheet } from "./build";
import { PHOTO_MAX_BYTES, PHOTO_MAX_SIDE } from "./photos";
import { SHEETS } from "./rows";
import { formatImportError, formatSummary, runImport } from "./run";
import {
  HAND_MAINTAINED,
  productRow,
  type SheetRecords,
  spreadsheet,
} from "../../../test/fixtures/catalogue-import";
import { renderSeedModule } from "./write";

// The whole import against temp folders: a spreadsheet folder, a public/ and
// a seed module. It writes only when every check passes, so a spreadsheet with
// any error leaves public/ and the seed module byte for byte as they were.

const CARDS = "ce-formula-flash-cards";
const PREVIOUS_SEED = "// the seed before this import\n";

let root: string;
let dir: string;
let publicDir: string;
let seedModulePath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ayc-import-"));
  dir = join(root, "spreadsheet");
  publicDir = join(root, "public");
  seedModulePath = join(root, "catalogue.generated.ts");
  await mkdir(join(dir, "photos"), { recursive: true });
  // The fixture's Live Product keeps two photos already in public/.
  await mkdir(join(publicDir, "products", CARDS), { recursive: true });
  await writeFile(join(publicDir, "products", CARDS, "1.webp"), "cover");
  await writeFile(join(publicDir, "products", CARDS, "2.webp"), "back");
  await writeFile(seedModulePath, PREVIOUS_SEED);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Saves the fixture spreadsheet, edited by the test, as the client sends it. */
async function saveSpreadsheet(edit?: (sheets: SheetRecords) => void) {
  const csvs = spreadsheet(edit);
  await Promise.all(SHEETS.map((sheet) => writeFile(join(dir, `${sheet}.csv`), csvs[sheet])));
  return csvs;
}

async function savePhoto(name: string, width: number, height: number) {
  await sharp({ create: { width, height, channels: 3, background: "#1f3a5f" } })
    .jpeg()
    .toFile(join(dir, "photos", name));
}

/** Every file under public/ and the seed module, by path, so a test can see nothing changed. */
async function snapshot() {
  const files = await readdir(publicDir, { recursive: true, withFileTypes: true });
  const contents = await Promise.all(
    files
      .filter((file) => file.isFile())
      .map(async (file) => {
        const path = join(file.parentPath, file.name);
        return [relative(publicDir, path), (await readFile(path)).toString("base64")] as const;
      }),
  );
  return {
    public: Object.fromEntries(contents),
    seedModule: await readFile(seedModulePath, "utf8"),
  };
}

const run = (check: boolean) =>
  runImport({ dir, check, handMaintained: HAND_MAINTAINED, publicDir, seedModulePath });

describe("runImport", () => {
  it("writes the seed module and optimised photos, and sums up what it imported", async () => {
    const csvs = await saveSpreadsheet((sheets) => {
      productRow(sheets, CARDS).photos = "cover.jpg|back.jpg";
    });
    await savePhoto("cover.jpg", 2400, 1600);
    await savePhoto("back.jpg", 1000, 1500);

    const result = await run(false);

    expect(result).toEqual({
      ok: true,
      summary: {
        exams: 1,
        subjects: 3,
        products: { live: 1, comingSoon: 1 },
        reviews: 1,
        photos: { kept: 0, optimised: 2 },
      },
    });
    // Cover first, each within 1200 px and 200 KB.
    for (const [n, width, height] of [
      [1, PHOTO_MAX_SIDE, 800],
      [2, 800, PHOTO_MAX_SIDE],
    ] as const) {
      const file = join(publicDir, "products", CARDS, `${n}.webp`);
      expect(await sharp(file).metadata()).toMatchObject({ format: "webp", width, height });
      expect((await readFile(file)).length).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
    }
    const { catalogue } = convertSpreadsheet(csvs, HAND_MAINTAINED);
    expect(await readFile(seedModulePath, "utf8")).toBe(await renderSeedModule(catalogue));
  });

  it("in check mode, reports the same summary and changes nothing", async () => {
    await saveSpreadsheet((sheets) => (productRow(sheets, CARDS).photos = "cover.jpg"));
    await savePhoto("cover.jpg", 600, 600);
    const before = await snapshot();

    const result = await run(true);

    expect(result).toEqual({
      ok: true,
      summary: expect.objectContaining({ photos: { kept: 0, optimised: 1 } }),
    });
    expect(await snapshot()).toEqual(before);
  });

  it("with any error, reports every one and leaves public/ and the seed module byte for byte", async () => {
    await saveSpreadsheet((sheets) => {
      const cards = productRow(sheets, CARDS);
      cards.photos = "cover.jpg|missing.jpg";
      cards.lazada_url = "https://shopee.ph/ce-cards-i.1.2";
      productRow(sheets, "ce-solving-notebook").price_from = "₱500";
      sheets.reviews.push({ product_slug: CARDS, stars: "6", text: "Good" });
    });
    // A valid photo the run would optimise, had nothing else been wrong.
    await savePhoto("cover.jpg", 600, 600);
    const before = await snapshot();

    const result = await run(false);

    expect(result.ok).toBe(false);
    expect(
      result.ok === false && result.errors.map((e) => `${e.sheet} ${e.row} ${e.column}`),
    ).toEqual([
      "products 2 lazada_url",
      "products 2 photos",
      "products 3 price_from",
      "reviews 3 stars",
    ]);
    expect(await snapshot()).toEqual(before);
  });

  it("reports all of a row's problems in one run, even when one of its cells can't be read", async () => {
    await saveSpreadsheet((sheets) => {
      Object.assign(productRow(sheets, CARDS), {
        price_from: "abc",
        lazada_url: "https://shopee.ph/ce-cards-i.1.2",
        photos: "nope.jpg",
      });
    });

    const result = await run(true);

    expect(result.ok === false && result.errors.map((e) => `${e.row} ${e.column}`)).toEqual([
      "2 price_from",
      "2 lazada_url",
      "2 photos",
    ]);
  });

  it("reports a missing CSV and a missing header, and changes nothing", async () => {
    await saveSpreadsheet();
    await rm(join(dir, "variations.csv"));
    await writeFile(join(dir, "exams.csv"), "code,board,name\nCE,CELE,Civil Engineering\n");
    const before = await snapshot();

    const result = await run(false);

    expect(result).toEqual({
      ok: false,
      errors: [
        { sheet: "exams", row: 1, column: "long_name", message: 'missing column "long_name"' },
        { sheet: "exams", row: 1, column: "blurb", message: 'missing column "blurb"' },
        { sheet: "exams", row: 1, column: "made_for", message: 'missing column "made_for"' },
        {
          sheet: "variations",
          row: null,
          column: null,
          message: "isn't in the spreadsheet folder",
        },
      ],
    });
    expect(await snapshot()).toEqual(before);
  });
});

describe("formatImportError", () => {
  it.each([
    [
      { sheet: "products", row: 7, column: "exam_code", message: 'unknown Exam "XX"' },
      'products.csv row 7, column exam_code: unknown Exam "XX"',
    ],
    [
      { sheet: "exams", row: 3, column: null, message: "an Exam needs at least one Subject" },
      "exams.csv row 3: an Exam needs at least one Subject",
    ],
    [
      { sheet: "variations", row: null, column: null, message: "isn't in the spreadsheet folder" },
      "variations.csv: isn't in the spreadsheet folder",
    ],
    [
      {
        sheet: null,
        row: null,
        column: null,
        message: "faqs.4.reviewQuote.reviewId: unknown Review",
      },
      "settings and FAQs (src/services/mock/catalogue.ts): faqs.4.reviewQuote.reviewId: unknown Review",
    ],
  ] as const)("prints %o as %j", (error, line) => {
    expect(formatImportError(error)).toBe(line);
  });
});

describe("formatSummary", () => {
  const summary = {
    exams: 5,
    subjects: 21,
    products: { live: 8, comingSoon: 7 },
    reviews: 16,
    photos: { kept: 22, optimised: 3 },
  };

  it("sums up an import", () => {
    expect(formatSummary(summary, false)).toBe(
      [
        "Exams     5 (21 Subjects)",
        "Products  15 (8 Live, 7 Coming Soon)",
        "Reviews   16",
        "Photos    22 kept, 3 optimised",
      ].join("\n"),
    );
  });

  it("says what a check would optimise", () => {
    expect(formatSummary(summary, true)).toContain("Photos    22 kept, 3 to optimise");
  });
});
