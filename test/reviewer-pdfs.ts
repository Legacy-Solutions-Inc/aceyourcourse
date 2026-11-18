import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reviewer PDFs for the tests (ticket 12). The fixtures are real PDFs of a few
// hundred bytes (test/fixtures/reviewer-pdfs/make-fixtures.mjs writes them);
// `pdfOfPages` is only enough of a PDF for the fake renderer, which counts its
// page objects, so a test can have a PDF of any length without one.

export type ReviewerPdfFixture = "three-pages" | "password" | "corrupt";

/** A fixture's bytes, read fresh: pdf.js takes over the buffer it's given. */
export function reviewerPdfFixture(name: ReviewerPdfFixture): Uint8Array {
  return new Uint8Array(
    readFileSync(join(import.meta.dirname, "fixtures", "reviewer-pdfs", `${name}.pdf`)),
  );
}

/** A PDF as the fake renderer reads one: `pages` page objects, encrypted if asked. */
export function pdfOfPages(pages: number, { encrypted = false } = {}): Uint8Array {
  const objects = Array.from(
    { length: pages },
    (_, index) => `${index + 3} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`,
  );
  return new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      `2 0 obj\n<< /Type /Pages /Count ${pages} >>\nendobj\n` +
      objects.join("") +
      `trailer\n<< /Root 1 0 R${encrypted ? " /Encrypt 99 0 R" : ""} >>\n%%EOF\n`,
  );
}
