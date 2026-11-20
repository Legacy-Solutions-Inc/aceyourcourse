import type { PageStamp } from "@/lib/reviewer-pdfs/stamp";

// The page-images interface (Phase 3, ticket 12; spec, Testing Decisions →
// Page images): the Reviewer PDF job renders an Editor's PDF a few pages at a
// time through a PdfRenderer, and stores each page image through the files
// port (ReviewerPdfFiles, src/services/uploads.ts). Both sit behind these
// small interfaces so the job's tests run on fakes, without real PDFs:
//   - pdf.js on a server-side canvas renders for real (page-images.pdfjs.ts),
//     tested on tiny fixture PDFs;
//   - the fake (page-images.fake.ts) reads a PDF's page count and renders
//     each page as the same small WebP, for the seam tests, the sample data
//     and the e2e.
// The Member App's page endpoint (ticket 14) stamps each page it sends
// through a PageStamper: sharp for real (page-images.sharp.ts), tested on
// tiny fixture images, and a fake for the Member seam's tests.

/** Why a PDF can't be split into pages: a password, or a file pdf.js can't read. */
export type PdfProblem = "password" | "corrupt";

/** A PDF opened for rendering. */
export interface OpenPdf {
  pageCount: number;
  /**
   * Renders one page (1 to pageCount) as a WebP image PAGE_WIDTH pixels wide.
   * Throws a PdfProblemError when the page can't be drawn, a RangeError for a
   * page it doesn't have, and anything else when the server fails.
   */
  renderPage(page: number): Promise<Uint8Array>;
  /** Frees what the PDF holds. Call it once done, whatever happened. */
  close(): Promise<void>;
}

/** What opening a PDF gives: the PDF, or why it can't be opened. */
export type OpenedPdf = { ok: true; pdf: OpenPdf } | { ok: false; problem: PdfProblem };

/** Renders a PDF's pages as images. */
export interface PdfRenderer {
  /**
   * Opens a PDF's bytes, which it may take over. Throws only when the server
   * fails, never for the file itself.
   */
  open(bytes: Uint8Array): Promise<OpenedPdf>;
}

/** A page that couldn't be drawn, which fails the job with its problem. */
export class PdfProblemError extends Error {
  constructor(readonly problem: PdfProblem) {
    super(`The PDF can't be split into pages: ${problem}.`);
    this.name = "PdfProblemError";
  }
}

/** Stamps a Member's details into a page image (spec, Phase 3 → Burned-in watermark). */
export interface PageStamper {
  /**
   * The page with the stamp burned in (src/lib/reviewer-pdfs/stamp.ts), as a
   * WebP the page's size. Never gives the clean page back. Throws when the
   * image can't be read or the server fails.
   */
  stamp(image: Uint8Array, stamp: PageStamp): Promise<Uint8Array>;
}
