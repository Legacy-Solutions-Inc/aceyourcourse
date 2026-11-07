// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateCatalogueSeed } from "@/services/catalogue.schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import * as generated from "@/services/mock/catalogue.generated";

import { convertSpreadsheet } from "./build";
import { readCsv } from "./parse";
import { parseSheet, SHEET_COLUMNS, SHEETS } from "./rows";
import { readSpreadsheet, runImport } from "./run";
import { renderSeedModule, SEED_MODULE_PATH } from "./write";

// The sample spreadsheet (data/catalogue/sample) is the mockup's catalogue,
// and the seed module generated from it is committed. Converting the sample
// must reproduce that module exactly, so a hand edit of the generated file, or
// an import change that alters its output, fails here.

const SAMPLE_DIR = fileURLToPath(new URL("../../../data/catalogue/sample", import.meta.url));
const TEMPLATE_DIR = fileURLToPath(new URL("../../../data/catalogue/template", import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL("../../../public", import.meta.url));

describe("the sample spreadsheet", () => {
  it("converts to exactly the generated seed's Exams, Products and Reviews", async () => {
    const { catalogue, errors } = convertSpreadsheet(
      await readSpreadsheet(SAMPLE_DIR),
      CATALOGUE_SEED,
    );

    expect(errors).toEqual([]);
    expect(catalogue).toEqual({
      exams: generated.exams,
      products: generated.products,
      reviews: generated.reviews,
    });
    expect(validateCatalogueSeed({ ...CATALOGUE_SEED, ...catalogue }).success).toBe(true);
  });

  it("renders to the committed seed module, byte for byte", async () => {
    const { catalogue } = convertSpreadsheet(await readSpreadsheet(SAMPLE_DIR), CATALOGUE_SEED);

    expect(await renderSeedModule(catalogue)).toBe(await readFile(SEED_MODULE_PATH, "utf8"));
  });

  it("checks cleanly against public/, keeping every photo it lists", async () => {
    const result = await runImport({
      dir: SAMPLE_DIR,
      check: true,
      handMaintained: CATALOGUE_SEED,
      publicDir: PUBLIC_DIR,
    });

    expect(result).toEqual({
      ok: true,
      summary: {
        exams: 5,
        subjects: 21,
        products: { live: 8, comingSoon: 7 },
        reviews: 16,
        photos: { kept: 22, optimised: 0 },
      },
    });
  });
});

describe("the template the client fills in", () => {
  it.each(SHEETS)(
    "%s.csv has exactly the import's headers and one example row that reads cleanly",
    async (sheet) => {
      const csv = readCsv(await readFile(`${TEMPLATE_DIR}/${sheet}.csv`, "utf8"));
      const { rows, errors } = parseSheet(sheet, csv);

      expect(csv.headers).toEqual(SHEET_COLUMNS[sheet]);
      expect(errors).toEqual([]);
      expect(rows).toHaveLength(1);
    },
  );
});
