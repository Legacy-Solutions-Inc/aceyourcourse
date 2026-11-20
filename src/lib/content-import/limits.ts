// The import files' rules (Phase 3, ticket 06), pure and dependency-free so
// the browser checks a file before uploading it, the upload seam before
// handing out an upload URL, and the readers (csv.ts, zip.ts) before reading.

/** The largest CSV an import reads: 10 MB, far more than a Subject's cards need. */
export const MAX_CSV_BYTES = 10 * 1024 * 1024;

/** The largest zip of images an import reads: 200 MB, like a Reviewer PDF. */
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/**
 * Each import file's rules: the type it's sent as (whatever the browser calls
 * the file), its extension, and its largest size, with what the field says
 * when it's bigger.
 */
export const IMPORT_FILES = {
  csv: {
    contentType: "text/csv",
    extension: "csv",
    max: MAX_CSV_BYTES,
    tooBig: "KEEP THE CSV TO 10 MB",
  },
  zip: {
    contentType: "application/zip",
    extension: "zip",
    max: MAX_ZIP_BYTES,
    tooBig: "KEEP THE ZIP TO 200 MB",
  },
} as const;
