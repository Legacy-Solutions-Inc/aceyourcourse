// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { productRow, spreadsheet } from "../../../test/fixtures/catalogue-import";

import { SHEETS } from "./rows";
import { SEED_MODULE_PATH } from "./write";

// The command itself, `pnpm catalogue:import <folder> [--check]`, run as the
// developer runs it: its exit code, what it prints, and that a spreadsheet
// with errors changes nothing in the repo.

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const TIMEOUT = 30_000;

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
}

async function catalogueImport(...args: string[]): Promise<Outcome> {
  const tsx = join(REPO, "node_modules", ".bin", "tsx");
  try {
    const { stdout, stderr } = await promisify(execFile)(
      tsx,
      ["scripts/catalogue-import.ts", ...args],
      { cwd: REPO },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    if (error instanceof Error && "code" in error && typeof error.code === "number") {
      const output = (key: string) => {
        const value: unknown = Reflect.get(error, key);
        return typeof value === "string" ? value : "";
      };
      return { code: error.code, stdout: output("stdout"), stderr: output("stderr") };
    }
    throw error;
  }
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ayc-cli-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("pnpm catalogue:import", () => {
  it(
    "checks the sample spreadsheet: exit 0, with the summary",
    async () => {
      const outcome = await catalogueImport("data/catalogue/sample", "--check");

      expect(outcome.code).toBe(0);
      expect(outcome.stdout).toContain(
        "data/catalogue/sample is ready to import. Nothing was changed.",
      );
      expect(outcome.stdout).toContain("Products  15 (8 Live, 7 Coming Soon)");
    },
    TIMEOUT,
  );

  it(
    "with an error, prints it at its sheet, row and column, exits 1 and changes nothing",
    async () => {
      const csvs = spreadsheet(
        (sheets) => (productRow(sheets, "ce-solving-notebook").exam_code = "XX"),
      );
      await Promise.all(SHEETS.map((sheet) => writeFile(join(dir, `${sheet}.csv`), csvs[sheet])));
      const seedModule = await readFile(SEED_MODULE_PATH, "utf8");

      for (const args of [[dir, "--check"], [dir]]) {
        const outcome = await catalogueImport(...args);

        expect(outcome.code).toBe(1);
        expect(outcome.stderr).toContain("Nothing was changed.");
        expect(outcome.stderr).toContain('products.csv row 3, column exam_code: unknown Exam "XX"');
      }
      expect(await readFile(SEED_MODULE_PATH, "utf8")).toBe(seedModule);
    },
    TIMEOUT,
  );

  it(
    "without a folder, prints how to use it and exits 1",
    async () => {
      const outcome = await catalogueImport();

      expect(outcome.code).toBe(1);
      expect(outcome.stderr).toContain(
        "Usage: pnpm catalogue:import <spreadsheet folder> [--check]",
      );
    },
    TIMEOUT,
  );
});
