// Where a Reviewer PDF's files are in the private `reviewer-pdfs` bucket
// (ticket 12), pure: its original at <id>/original.pdf, and page n at
// <id>/pages/<n>.webp. The paths come from the id alone, so no record lists
// them: a Reviewer PDF's pages 1 to `pagesDone` are there.

/** The private bucket for Reviewer PDFs' originals and page images. */
export const REVIEWER_PDFS_BUCKET = "reviewer-pdfs";

const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ORIGINAL = new RegExp(`^(${ID})/original\\.pdf$`);

/** Pure: where a Reviewer PDF's original is. */
export const originalPath = (id: string) => `${id}/original.pdf`;

/** Pure: where a Reviewer PDF's page image is (page 1 first). */
export const pagePath = (id: string, page: number) => `${id}/pages/${page}.webp`;

/** Pure: every file a Reviewer PDF of `pageCount` pages can have: its original, then each page. */
export function reviewerPdfPaths(id: string, pageCount: number): string[] {
  return [originalPath(id), ...Array.from({ length: pageCount }, (_, i) => pagePath(id, i + 1))];
}

/** Pure: the Reviewer PDF an original's path names, or null when it isn't one. */
export function idOfOriginal(path: string): string | null {
  return ORIGINAL.exec(path)?.[1] ?? null;
}
