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

const UNKNOWN_UPLOAD = "UNKNOWN UPLOAD";

/** The file the browser is about to send: its type and size. */
export const uploadFileSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES, { errorMap: () => ({ message: WRONG_UPLOAD_TYPE }) }),
  size: z
    .number({ invalid_type_error: UPLOAD_TOO_BIG, required_error: UPLOAD_TOO_BIG })
    .int(UPLOAD_TOO_BIG)
    .positive("THE FILE IS EMPTY")
    .max(MAX_UPLOAD_BYTES, UPLOAD_TOO_BIG),
});

/** One plain path segment: a Product's id or an Exam's code. */
export const UPLOAD_OWNER = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

/**
 * What a file is for: a Product (its id) or an Exam (its code). Storage files
 * it in that folder (ticket 17), so it's one plain path segment.
 */
export const uploadOwnerSchema = z
  .string({ invalid_type_error: UNKNOWN_UPLOAD })
  .regex(UPLOAD_OWNER, UNKNOWN_UPLOAD);

/**
 * An upload as the browser asks for it, before it sends the file. A Product
 * photo names its Product once it has one (a new Product has no id until its
 * first save); a share image always names its Exam.
 */
export const uploadRequestSchema = uploadFileSchema
  .extend({
    purpose: z.enum(UPLOAD_PURPOSES, { errorMap: () => ({ message: UNKNOWN_UPLOAD }) }),
    owner: uploadOwnerSchema.optional(),
  })
  .refine((request) => request.purpose !== "share-image" || request.owner !== undefined, {
    path: ["owner"],
    message: UNKNOWN_UPLOAD,
  });

export type UploadRequest = z.input<typeof uploadRequestSchema>;

/** Where the browser sends one file, and where it will be once sent. */
export interface UploadTicket {
  /** One-time: the browser PUTs the file here, once. */
  uploadUrl: string;
  /** What a save records, e.g. a Product photo's. */
  path: string;
  /** Where the Website loads the file from once it's uploaded. */
  publicUrl: string;
}

/**
 * What a save finds at an upload's path: the file's public URL once it's
 * uploaded, "waiting" while the browser hasn't sent it, or null for a path
 * that isn't an upload of this purpose.
 */
export type UploadLookup = (
  path: string,
  purpose: UploadRequest["purpose"],
) => { publicUrl: string } | "waiting" | null;
