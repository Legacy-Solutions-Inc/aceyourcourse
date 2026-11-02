import { z } from "zod";

// The upload seam's inputs and outputs (CONVENTIONS §3; spec, Phase 2 → Seams:
// Image upload). A Staff-checked Server Action hands the browser a one-time
// upload URL, the browser PUTs the file to it, and the save records the
// file's path. The rules here are shared with the browser, which checks a
// file before uploading it.

/** The image types an upload accepts: JPEG, PNG or WebP. */
export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

/** The largest file an upload accepts: 10 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** What an upload is for: a Product photo, or a share image (ticket 09). */
export const UPLOAD_PURPOSES = ["product-photo", "share-image"] as const;

export const WRONG_UPLOAD_TYPE = "USE A JPEG, PNG OR WEBP IMAGE";
export const UPLOAD_TOO_BIG = "KEEP EACH PHOTO TO 10 MB";

/** An upload as the browser asks for it, before it sends the file. */
export const uploadRequestSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES, { errorMap: () => ({ message: "UNKNOWN UPLOAD" }) }),
  contentType: z.enum(UPLOAD_CONTENT_TYPES, { errorMap: () => ({ message: WRONG_UPLOAD_TYPE }) }),
  size: z
    .number({ invalid_type_error: UPLOAD_TOO_BIG, required_error: UPLOAD_TOO_BIG })
    .int(UPLOAD_TOO_BIG)
    .positive("THE FILE IS EMPTY")
    .max(MAX_UPLOAD_BYTES, UPLOAD_TOO_BIG),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/** Where the browser sends one file, and where it will be once sent. */
export interface UploadTicket {
  /** One-time: the browser PUTs the file here, once. */
  uploadUrl: string;
  /** What a save records, e.g. a Product photo's. */
  path: string;
  /** Where the Website loads the file from once it's uploaded. */
  publicUrl: string;
}
