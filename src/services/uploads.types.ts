import { z } from "zod";

import { IMPORT_FILES } from "@/lib/card-import/limits";
import {
  CARD_IMAGE_TYPES,
  type CardImageType,
  EMPTY_IMAGE,
  IMAGE_TOO_BIG,
  MAX_CARD_IMAGE_BYTES,
  WRONG_IMAGE_TYPE,
} from "@/lib/cards/card-rules";
import { ABOUT_PHOTO_SLOTS } from "@/lib/catalogue/about-content";
import { isSitePageKey } from "@/services/catalogue.schema";

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

/**
 * What an upload is for: a Product photo, an Exam page's share image (ticket
 * 09), a Site page's share image (ticket 20), or one of About's four photos
 * (ticket 21).
 */
export const UPLOAD_PURPOSES = [
  "product-photo",
  "share-image",
  "site-page-share-image",
  "about-photo",
] as const;

const isAboutPhotoSlot = (value: unknown) => ABOUT_PHOTO_SLOTS.some((slot) => slot === value);

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
 * What a file is for: a Product (its id), an Exam (its code), a Site page
 * ("about") or one of About's photos ("story-2"). Storage files it in that
 * folder (ticket 17), or names the file after it, so it's one plain path
 * segment.
 */
export const uploadOwnerSchema = z
  .string({ invalid_type_error: UNKNOWN_UPLOAD })
  .regex(UPLOAD_OWNER, UNKNOWN_UPLOAD);

/**
 * An upload as the browser asks for it, before it sends the file. A Product
 * photo names its Product once it has one (a new Product has no id until its
 * first save); a share image always names its Exam, a Site page's share
 * image its Site page, and an About photo its slot (team, story-1, story-2
 * or story-3).
 */
export const uploadRequestSchema = uploadFileSchema
  .extend({
    purpose: z.enum(UPLOAD_PURPOSES, { errorMap: () => ({ message: UNKNOWN_UPLOAD }) }),
    owner: uploadOwnerSchema.optional(),
  })
  .refine(
    ({ purpose, owner }) => {
      switch (purpose) {
        case "product-photo":
          return true;
        case "share-image":
          return owner !== undefined;
        case "site-page-share-image":
          return isSitePageKey(owner);
        case "about-photo":
          return isAboutPhotoSlot(owner);
      }
    },
    { path: ["owner"], message: UNKNOWN_UPLOAD },
  );

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

// ── Private content uploads (Phase 3, tickets 06 and 07) ────────────────────
// An Editor's card import: the browser uploads its CSV and its zip of images
// straight to the private content bucket, as it does a photo to the public
// one (the zip can be far bigger than a Server Action may take). The card
// editor (ticket 07) uploads a card's back image there the same way. These
// files are never public: an upload gives no public URL, and only the server
// reads them back, to plan and confirm an import or to save a card.

/** What a private upload is for: an import's CSV or zip of images, or a card's back image. */
export const CONTENT_UPLOAD_PURPOSES = [
  "card-import-csv",
  "card-import-zip",
  "card-image",
] as const;

export type ContentUploadPurpose = (typeof CONTENT_UPLOAD_PURPOSES)[number];

/** The import's private uploads. */
export type ImportUploadPurpose = Exclude<ContentUploadPurpose, "card-image">;

/** Each import upload's rules (src/lib/card-import/limits.ts): its type, extension and largest size. */
export const CONTENT_UPLOADS = {
  "card-import-csv": IMPORT_FILES.csv,
  "card-import-zip": IMPORT_FILES.zip,
} as const satisfies Record<ImportUploadPurpose, (typeof IMPORT_FILES)[keyof typeof IMPORT_FILES]>;

export type ContentUploadType =
  (typeof CONTENT_UPLOADS)[ImportUploadPurpose]["contentType"] | CardImageType;

const EMPTY_FILE = "THE FILE IS EMPTY";

/** An import file as the browser asks for it: its size, held to its purpose's limit below. */
const importFileSize = z
  .number({ invalid_type_error: EMPTY_FILE, required_error: EMPTY_FILE })
  .int(EMPTY_FILE)
  .positive(EMPTY_FILE);

/** A card's back image as the browser asks to upload it: a JPEG, PNG or WebP of at most 5 MB. */
export const cardImageFileSchema = z.object({
  contentType: z.enum(CARD_IMAGE_TYPES, { errorMap: () => ({ message: WRONG_IMAGE_TYPE }) }),
  size: z
    .number({ invalid_type_error: EMPTY_IMAGE, required_error: EMPTY_IMAGE })
    .int(EMPTY_IMAGE)
    .positive(EMPTY_IMAGE)
    .max(MAX_CARD_IMAGE_BYTES, IMAGE_TOO_BIG),
});

/**
 * A private upload as the browser asks for it: what it's for and the file's
 * size, and for a card's back image its type (a JPEG, PNG or WebP of at most
 * 5 MB, src/lib/cards/card-rules.ts). The browser checks the same first.
 */
export const contentUploadRequestSchema = z
  .discriminatedUnion(
    "purpose",
    [
      z.object({ purpose: z.literal("card-import-csv"), size: importFileSize }),
      z.object({ purpose: z.literal("card-import-zip"), size: importFileSize }),
      cardImageFileSchema.extend({ purpose: z.literal("card-image") }),
    ],
    {
      errorMap: (issue, ctx) =>
        issue.code === z.ZodIssueCode.invalid_union_discriminator
          ? { message: UNKNOWN_UPLOAD }
          : { message: ctx.defaultError },
    },
  )
  .superRefine((request, ctx) => {
    if (request.purpose === "card-image") return;
    const { max, tooBig } = CONTENT_UPLOADS[request.purpose];
    if (request.size > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["size"], message: tooBig });
    }
  });

export type ContentUploadRequest = z.input<typeof contentUploadRequestSchema>;

/** A private upload's one-time URL. There's no public URL: only the server reads the file. */
export interface ContentUploadTicket {
  uploadUrl: string;
  /** What the import or the card's save sends back, for the server to read the file at. */
  path: string;
  /** The type to PUT the file as. */
  contentType: ContentUploadType;
}
