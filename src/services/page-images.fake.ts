import { type PageStamp, stampText } from "@/lib/reviewer-pdfs/stamp";
import type { OpenedPdf, PageStamper, PdfRenderer } from "@/services/page-images.types";

// The fake page renderer (ticket 12): the seam tests, the sample data and the
// e2e use it in place of pdf.js. The fake stamper (ticket 14) stands in for
// sharp in the Member seam's tests. It reads what pdf.js would from a PDF's
// bytes, roughly: a file that doesn't start as a PDF, or has no page objects,
// is corrupt, and one with an /Encrypt entry needs a password. Every page
// "renders" as the same small blank WebP. The sample data's takes its time
// over each page, so the Admin shows a job's progress as a real one would.

/** A blank page: a 16 × 21 lossless WebP. */
export const FAKE_PAGE_IMAGE = new Uint8Array([
  82, 73, 70, 70, 30, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 76, 17, 0, 0, 0, 47, 15, 0, 5, 0, 7, 208,
  255, 254, 247, 191, 255, 129, 136, 232, 127, 0, 0,
]);

const PDF_HEADER = "%PDF-";
/** A page object: /Type /Page, but not /Pages. */
const PAGE_OBJECT = /\/Type\s*\/Page(?![A-Za-z])/g;
const ENCRYPTED = /\/Encrypt[\s/]/;

/** Pure: what pdf.js would make of these bytes, as far as the fake can tell. */
function read(
  bytes: Uint8Array,
): { ok: true; pageCount: number } | Extract<OpenedPdf, { ok: false }> {
  const text = new TextDecoder("latin1").decode(bytes);
  if (!text.startsWith(PDF_HEADER)) return { ok: false, problem: "corrupt" };
  if (ENCRYPTED.test(text)) return { ok: false, problem: "password" };
  const pageCount = text.match(PAGE_OBJECT)?.length ?? 0;
  return pageCount > 0 ? { ok: true, pageCount } : { ok: false, problem: "corrupt" };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A fake renderer, which spends `msPerPage` over each page (none by default). */
export function createFakeRenderer({ msPerPage = 0 }: { msPerPage?: number } = {}): PdfRenderer {
  return {
    async open(bytes) {
      const found = read(bytes);
      if (!found.ok) return found;
      const { pageCount } = found;
      return {
        ok: true,
        pdf: {
          pageCount,
          async renderPage(page) {
            if (!Number.isInteger(page) || page < 1 || page > pageCount) {
              throw new RangeError(`The PDF has no page ${page}.`);
            }
            if (msPerPage > 0) await wait(msPerPage);
            return FAKE_PAGE_IMAGE.slice();
          },
          async close() {},
        },
      };
    },
  };
}

/**
 * Pure: what the fake stamper makes of a page: its bytes, then the stamp's
 * text, so a test sees which page was stamped for which Member. Not an image.
 */
export function fakeStamped(image: Uint8Array, stamp: PageStamp): Uint8Array {
  const text = new TextEncoder().encode(` STAMPED ${stampText(stamp)}`);
  const stamped = new Uint8Array(image.byteLength + text.byteLength);
  stamped.set(image);
  stamped.set(text, image.byteLength);
  return stamped;
}

/** The fake stamper, for the Member seam's tests. */
export const fakeStamper: PageStamper = {
  async stamp(image, stamp) {
    return fakeStamped(image, stamp);
  },
};
