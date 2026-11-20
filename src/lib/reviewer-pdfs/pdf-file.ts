import { MAX_PDF_BYTES } from "@/lib/reviewer-pdfs/job";

// What a Reviewer PDF upload must be (ticket 12), pure: a PDF of up to
// 200 MB. The browser checks a file before uploading it, and the upload seam
// checks the same again on the server (uploads.types.ts); Storage's bucket
// holds to it too, and the job fails a file that isn't really a PDF.

export const PDF_CONTENT_TYPE = "application/pdf";

/** The longest file name a Reviewer PDF keeps; a longer one is cut to it. */
export const PDF_NAME_MAX = 200;

export const NOT_A_PDF = "USE A PDF FILE";
export const PDF_TOO_BIG = "KEEP THE PDF TO 200 MB";
export const EMPTY_FILE = "THE FILE IS EMPTY";

/**
 * The types a browser may give a PDF: its own, an old one, or none it knows
 * (some systems give a PDF no type, or "application/octet-stream"), when the
 * name ends in .pdf.
 */
const PDF_TYPES = new Set([PDF_CONTENT_TYPE, "application/x-pdf"]);
const UNKNOWN_TYPES = new Set(["", "application/octet-stream"]);

/** The file the Editor chose, as the browser describes it. */
export interface ChosenFile {
  name: string;
  type: string;
  size: number;
}

/** Pure: whether the browser says the file is a PDF. */
export function isPdfFile({ name, type }: Pick<ChosenFile, "name" | "type">): boolean {
  return PDF_TYPES.has(type) || (UNKNOWN_TYPES.has(type) && /\.pdf$/i.test(name));
}

/** Pure: why the file can't be uploaded as a Reviewer PDF, or null when it can. */
export function pdfFileProblem(file: ChosenFile): string | null {
  if (!isPdfFile(file)) return NOT_A_PDF;
  if (file.size <= 0) return EMPTY_FILE;
  if (file.size > MAX_PDF_BYTES) return PDF_TOO_BIG;
  return null;
}

/** Pure: a file's size for the Admin's list, "14.2 MB", or "312 KB" under 1 MB. */
export function fileSizeLabel(bytes: number): string {
  const megabytes = bytes / 1024 / 1024;
  return megabytes >= 1
    ? `${Math.round(megabytes * 10) / 10} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
