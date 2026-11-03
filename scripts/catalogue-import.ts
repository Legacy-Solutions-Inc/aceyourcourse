import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { formatImportError, formatSummary, runImport } from "@/lib/catalogue-import/run";
import { SEED_MODULE_PATH } from "@/lib/catalogue-import/write";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

// ─────────────────────────────────────────────────────────────────────────────
// pnpm catalogue:import <folder> [--check]
//
// Turns the client's catalogue spreadsheet (a folder of CSVs, one per sheet,
// and a photos/ folder) into the Website's seed. With --check it only checks
// the spreadsheet and writes nothing. Any error is printed with its sheet, row
// and column, the command exits 1, and no file is changed. See
// data/catalogue/template/README.md for the columns.
// ─────────────────────────────────────────────────────────────────────────────

const REPO = fileURLToPath(new URL("..", import.meta.url));

const { values, positionals } = parseArgs({
  options: { check: { type: "boolean", default: false } },
  allowPositionals: true,
});
const [folder] = positionals;
if (folder === undefined || positionals.length > 1) {
  console.error("Usage: pnpm catalogue:import <spreadsheet folder> [--check]");
  process.exit(1);
}

const check = values.check;
const result = await runImport({
  dir: resolve(folder),
  check,
  // The settings, FAQs and Exam pages stay in code; they are checked with the spreadsheet.
  handMaintained: CATALOGUE_SEED,
  publicDir: join(REPO, "public"),
});

if (!result.ok) {
  const count = result.errors.length;
  console.error(
    `${count} ${count === 1 ? "problem" : "problems"} in ${folder}. Nothing was changed.\n`,
  );
  for (const error of result.errors) console.error(formatImportError(error));
  process.exit(1);
}

console.log(
  check ? `${folder} is ready to import. Nothing was changed.\n` : `Imported ${folder}.\n`,
);
console.log(formatSummary(result.summary, check));
if (!check) console.log(`\nWrote ${relative(REPO, SEED_MODULE_PATH)}`);
