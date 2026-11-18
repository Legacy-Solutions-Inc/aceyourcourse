import "server-only";

import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { createCanvas } from "@napi-rs/canvas";

import { PAGE_WIDTH } from "@/lib/reviewer-pdfs/job";
import { type PdfProblem, PdfProblemError, type PdfRenderer } from "@/services/page-images.types";

// ─────────────────────────────────────────────────────────────────────────────
// The real page renderer (Phase 3, ticket 12; spec, Phase 3 planning
// decisions → The Reviewer PDF job): pdf.js (pdfjs-dist, Apache-2.0) draws
// each page on a server-side canvas (@napi-rs/canvas, MIT), which encodes it
// as WebP. Both are permissive; no AGPL MuPDF. Both are left out of Next's
// server bundle (serverExternalPackages, next.config.ts), so the canvas's
// native binary and pdf.js's font, CMap and wasm files load from
// node_modules, which the run route's file tracing includes.
//
// pdf.js runs in the server's own thread: importing its worker module first
// gives it the worker's code in place of a separate worker file. Fonts are
// drawn as paths (no FontFace in Node), and no system font is read.
// ─────────────────────────────────────────────────────────────────────────────

/** The quality WebP pages are saved at: sharp text, at a third of PNG's size. */
const WEBP_QUALITY = 80;

/**
 * The tallest page image, in pixels. A page far taller than it is wide (a
 * long scroll pasted into a PDF) is drawn narrower, so that one page can't
 * make the canvas hold hundreds of megabytes.
 */
const MAX_PAGE_HEIGHT = 8000;

/** pdf.js's own exceptions, by name, and what each says about the file. */
const PROBLEMS: Record<string, PdfProblem> = {
  PasswordException: "password",
  InvalidPDFException: "corrupt",
  FormatError: "corrupt",
  UnknownErrorException: "corrupt",
};

/** Pure: the problem a pdf.js exception names, or null for any other error (the server's). */
function problemOf(error: unknown): PdfProblem | null {
  if (!(error instanceof Error)) return null;
  return Object.hasOwn(PROBLEMS, error.name) ? (PROBLEMS[error.name] ?? null) : null;
}

/** Where pdf.js's data files are: its standard fonts, CMaps, ICC profiles and wasm decoders. */
function dataFolders() {
  const root = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  const folder = (name: string) => `${join(root, name)}/`;
  return {
    standardFontDataUrl: folder("standard_fonts"),
    cMapUrl: folder("cmaps"),
    cMapPacked: true,
    iccUrl: folder("iccs"),
    wasmUrl: folder("wasm"),
  };
}

/** pdf.js, loaded on first use: its worker's code first, so it runs in this thread. */
async function loadPdfjs() {
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export const pdfjsRenderer: PdfRenderer = {
  async open(bytes) {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({
      data: bytes,
      ...dataFolders(),
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    });
    let document;
    try {
      document = await task.promise;
    } catch (error) {
      await task.destroy();
      const problem = problemOf(error);
      if (problem) return { ok: false, problem };
      throw error;
    }
    const pageCount = document.numPages;
    return {
      ok: true,
      pdf: {
        pageCount,
        async renderPage(number) {
          if (!Number.isInteger(number) || number < 1 || number > pageCount) {
            throw new RangeError(`The PDF has no page ${number}.`);
          }
          try {
            const page = await document.getPage(number);
            try {
              const natural = page.getViewport({ scale: 1 });
              const scale = Math.min(PAGE_WIDTH / natural.width, MAX_PAGE_HEIGHT / natural.height);
              const viewport = page.getViewport({ scale });
              const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
              await page.render({
                // pdf.js types its canvas as the DOM's; @napi-rs/canvas is the
                // server's stand-in for it, which pdf.js supports in Node.
                canvas: canvas as unknown as HTMLCanvasElement,
                viewport,
              }).promise;
              return new Uint8Array(await canvas.encode("webp", WEBP_QUALITY));
            } finally {
              page.cleanup();
            }
          } catch (error) {
            const problem = problemOf(error);
            throw problem ? new PdfProblemError(problem) : error;
          }
        },
        async close() {
          await task.destroy();
        },
      },
    };
  },
};
