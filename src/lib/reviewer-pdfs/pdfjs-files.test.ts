// @vitest-environment node
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PDFJS_DATA_FOLDERS, PDFJS_DIR, tracedPdfjsFiles } from "@/lib/reviewer-pdfs/pdfjs-files";
import { STAMP_FONT_PATH } from "@/lib/reviewer-pdfs/stamp";

// Where pdf.js's own files are, from the app's folder (tickets 12 and 14):
// the renderer and the stamper read them from there, and the build's file
// tracing sends them with the routes that do. A bundler turns a package
// lookup (require.resolve) into a module number, so nothing finds them that way.

describe("pdf.js's files", () => {
  it("are in pdfjs-dist, in the app's folder", () => {
    expect(statSync(join(process.cwd(), PDFJS_DIR, "package.json")).isFile()).toBe(true);
  });

  it.each(PDFJS_DATA_FOLDERS)("include the %s folder the renderer reads", (folder) => {
    expect(statSync(join(process.cwd(), PDFJS_DIR, folder)).isDirectory()).toBe(true);
  });

  it("include the font the stamp is drawn in", () => {
    expect(STAMP_FONT_PATH.startsWith(`${PDFJS_DIR}/`)).toBe(true);
    expect(existsSync(join(process.cwd(), STAMP_FONT_PATH))).toBe(true);
  });

  it("are traced with the job's run route: its package and every data folder", () => {
    expect(tracedPdfjsFiles()).toEqual([
      "./node_modules/pdfjs-dist/package.json",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/pdfjs-dist/iccs/**",
      "./node_modules/pdfjs-dist/wasm/**",
    ]);
  });
});
