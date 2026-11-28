import "server-only";

import { env } from "@/env";
import { CARD_IMAGE_EXTENSIONS, CARD_IMAGE_TYPES } from "@/lib/cards/card-rules";
import { ABOUT_PHOTO_SLOTS } from "@/lib/catalogue/about-content";
import { bucketObjectPath, CATALOGUE_BUCKET } from "@/lib/catalogue-bucket";
import { hasFileSignature } from "@/lib/file-signature";
import {
  idOfOriginal,
  originalPath,
  pagePath,
  REVIEWER_PDFS_BUCKET,
  reviewerPdfPaths,
} from "@/lib/reviewer-pdfs/paths";
import { getStorage, type StorageConnection } from "@/lib/supabase/admin";
import { invalidInput } from "@/services/admin.schema";
import type { AdminResult, StaffActor } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { ContentFiles, ReviewerPdfFiles, UploadService } from "@/services/uploads";
import {
  CONTENT_UPLOADS,
  type ContentUploadPurpose,
  type ContentUploadRequest,
  contentUploadRequestSchema,
  type ContentUploadTicket,
  type ReviewerPdfUploadRequest,
  reviewerPdfUploadRequestSchema,
  type ReviewerPdfUploadTicket,
  UPLOAD_OWNER,
  UPLOAD_PURPOSES,
  type UploadContentType,
  type UploadLookup,
  type UploadRequest,
  uploadRequestSchema,
  type UploadTicket,
} from "@/services/uploads.types";

// ─────────────────────────────────────────────────────────────────────────────
// The upload seam's Storage arm (ticket 17; CONVENTIONS §3), selected with
// the database. Files go to the public `catalogue` bucket, which enforces the
// upload rules itself: JPEG, PNG or WebP, up to 10 MB
// (supabase/migrations/…_catalogue_bucket.sql).
//   - createUpload signs a one-time upload URL with the secret key, which
//     never leaves the server (src/lib/supabase/admin.ts). The browser PUTs
//     the file there, as it does to the sample arm's route.
//   - Before a save runs, the Admin's database arm asks which of its upload
//     paths are in the bucket (lookupUploads), so the save can resolve them.
//   - After a save commits, it deletes the files the save stopped using
//     (removeImages). A failed delete is logged and never fails the save: a
//     stray file costs a little storage, nothing on the Website.
//
// Private uploads and card images (Phase 3, ticket 06) go to the PRIVATE
// `content` bucket (supabase/migrations/…_content_bucket.sql), which has no
// public URLs: createContentUpload signs a one-time upload URL for an
// import's CSV or zip, or a card's back image (ticket 07), and the card
// import and card editor read it back, store each card's image and delete
// what they no longer need through contentFiles.
//
// Reviewer PDFs (Phase 3, ticket 12) go to their own PRIVATE bucket,
// `reviewer-pdfs` (supabase/migrations/…_reviewer_pdfs_bucket.sql), up to
// 200 MB each: createReviewerPdfUpload signs a one-time token for a resumable
// (TUS) upload straight from the browser, and the Reviewer PDF's record and
// its job read the original and store the page images through
// reviewerPdfFiles. Nothing there is ever given a public or signed URL.
// ─────────────────────────────────────────────────────────────────────────────

/** The private bucket: card images, and the files an import uploads. */
export const CONTENT_BUCKET = "content";

/** Supabase's TUS endpoint for uploads on a signed token (Storage → Resumable uploads). */
const RESUMABLE_UPLOAD = "/storage/v1/upload/resumable/sign";

/** How many files Storage deletes in one request. */
const REMOVE_BATCH = 1000;

const EXTENSIONS: Record<UploadContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A new Product's photos wait here: it has no id until its first save. */
const NEW_PRODUCT = "new";
/** A new Course's cover waits here, the same way. */
const NEW_COURSE = "new";

const UPLOAD_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const OWNER = UPLOAD_OWNER.source.slice(1, -1);
const EXTENSION = `(?:${Object.values(EXTENSIONS).join("|")})`;

/** Where each kind of upload goes in the bucket. Only uploads are filed this way. */
const UPLOAD_PATHS: Record<UploadRequest["purpose"], RegExp> = {
  "product-photo": new RegExp(`^products/${OWNER}/${UPLOAD_ID}\\.${EXTENSION}$`),
  "share-image": new RegExp(`^exam-pages/${OWNER}/share-${UPLOAD_ID}\\.${EXTENSION}$`),
  "site-page-share-image": new RegExp(`^site-pages/${OWNER}/share-${UPLOAD_ID}\\.${EXTENSION}$`),
  "about-photo": new RegExp(
    `^site-pages/about/(?:${ABOUT_PHOTO_SLOTS.join("|")})-${UPLOAD_ID}\\.${EXTENSION}$`,
  ),
  "course-cover": new RegExp(`^courses/${OWNER}/cover-${UPLOAD_ID}\\.${EXTENSION}$`),
};

/** Where an upload is filed: under its Product, its Exam or its Site page, or as one of About's photos. */
const FOLDERS: Record<
  UploadRequest["purpose"],
  (owner: string | undefined, file: string) => string
> = {
  "product-photo": (owner, file) => `products/${owner ?? NEW_PRODUCT}/${file}`,
  "share-image": (owner, file) => `exam-pages/${owner}/share-${file}`,
  "site-page-share-image": (owner, file) => `site-pages/${owner}/share-${file}`,
  "about-photo": (slot, file) => `site-pages/about/${slot}-${file}`,
  "course-cover": (owner, file) => `courses/${owner ?? NEW_COURSE}/cover-${file}`,
};

/**
 * Pure: whether a path is where a private upload of this purpose is filed: an
 * import's file at imports/<uuid>.<extension>, a card's back image at
 * card-images/<uuid>.<jpg|png|webp>.
 */
function isContentUploadPath(path: string, purpose: ContentUploadPurpose): boolean {
  const pattern =
    purpose === "card-image"
      ? `^card-images/${UPLOAD_ID}\\.${EXTENSION}$`
      : `^imports/${UPLOAD_ID}\\.${CONTENT_UPLOADS[purpose].extension}$`;
  return new RegExp(pattern).test(path);
}

/**
 * Pure: whether a path is where a stored image is: a card's back image at
 * decks/<deck uuid>/<uuid>.<jpg|png|webp> (ticket 06), or a quiz question's
 * figure at quizzes/<quiz uuid>/<uuid>.<jpg|png|webp> (ticket 09).
 */
const isStoredImagePath = (path: string) =>
  new RegExp(`^(decks|quizzes)/${UPLOAD_ID}/${UPLOAD_ID}\\.${EXTENSION}$`).test(path);

/** Pure: the purpose of the upload filed at this path, or null when no upload is. */
function uploadPurposeAt(path: string): UploadRequest["purpose"] | null {
  return UPLOAD_PURPOSES.find((purpose) => UPLOAD_PATHS[purpose].test(path)) ?? null;
}

/** Pure: every upload path in a save's arguments, however deep, once each, in order. */
export function uploadPathsIn(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (item: unknown): void => {
    if (typeof item === "string") {
      if (uploadPurposeAt(item)) found.add(item);
    } else if (Array.isArray(item)) {
      item.forEach(visit);
    } else if (item && typeof item === "object") {
      Object.values(item).forEach(visit);
    }
  };
  visit(value);
  return [...found];
}

/**
 * Every image the catalogue uses: its Products' photos, its Exam and Site
 * pages' share images, and About's replaced photos.
 */
function imagesOf(catalogue: CatalogueSeed): string[] {
  return [
    ...catalogue.products.flatMap((product) => product.photos.map((photo) => photo.src)),
    ...[...catalogue.examPages, ...catalogue.sitePages].flatMap((page) =>
      page.shareImage ? [page.shareImage] : [],
    ),
    ...catalogue.sitePages.flatMap(({ about }) =>
      about
        ? [about.header.teamPhoto, ...about.story.photos].flatMap((photo) =>
            photo ? [photo.src] : [],
          )
        : [],
    ),
  ];
}

/**
 * Pure: the images a save stopped using: a photo taken off its Product, every
 * photo of a deleted Product, a share image replaced or cleared, and an About
 * photo replaced or put back to today's. An image still used anywhere in the
 * catalogue isn't one.
 */
export function imagesRemoved(before: CatalogueSeed, after: CatalogueSeed): string[] {
  const kept = new Set(imagesOf(after));
  return [...new Set(imagesOf(before))].filter((src) => !kept.has(src));
}

export interface StorageArm extends UploadService {
  /** The private content bucket, for the card import (ticket 06). */
  contentFiles: ContentFiles;
  /** The private Reviewer PDFs bucket, for the Reviewer PDFs screen and job (ticket 12). */
  reviewerPdfFiles: ReviewerPdfFiles;
  /**
   * Asks Storage which of these upload paths have their file, and gives what
   * a save finds at each (sample-store.ts's uploadAt). Paths that aren't
   * uploads are left alone. Throws when Storage can't say.
   */
  lookupUploads(paths: readonly string[]): Promise<UploadLookup>;
  /**
   * Deletes the bucket's files among these images (each a photo's src).
   * Images elsewhere, such as the Phase 1 photos in public/, are left alone.
   * Logs a failure, and never throws.
   */
  removeImages(srcs: readonly string[]): Promise<void>;
}

/**
 * The Storage arm, on the Storage `connect` gives; it throws when there's
 * none. A resumable upload also sends the project's publishable key, which
 * the browser may know anyway, as Supabase's own clients do.
 */
export function createStorageArm(
  connect: () => StorageConnection,
  publishableKey: string | undefined = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
): StorageArm {
  const bucket = () => connect().client.storage.from(CATALOGUE_BUCKET);
  const contentBucket = () => connect().client.storage.from(CONTENT_BUCKET);
  const pdfBucket = () => connect().client.storage.from(REVIEWER_PDFS_BUCKET);

  async function createUpload(
    actor: StaffActor | null,
    request: UploadRequest,
  ): Promise<AdminResult<UploadTicket>> {
    if (!actor)
      return { ok: false, error: { kind: "forbidden", message: "SIGN IN TO UPLOAD PHOTOS" } };
    const parsed = uploadRequestSchema.safeParse(request);
    if (!parsed.success) return { ok: false, error: invalidInput(parsed.error) };

    const { purpose, owner, contentType } = parsed.data;
    const file = `${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;
    const path = FOLDERS[purpose](owner, file);
    const files = bucket();
    const { data, error } = await files.createSignedUploadUrl(path);
    if (error) throw new Error(`Storage couldn't make an upload URL: ${error.message}`);
    return {
      ok: true,
      value: {
        uploadUrl: data.signedUrl,
        path,
        publicUrl: files.getPublicUrl(path).data.publicUrl,
      },
      tags: [],
    };
  }

  async function lookupUploads(paths: readonly string[]): Promise<UploadLookup> {
    const uploads = paths.filter((path) => uploadPurposeAt(path) !== null);
    if (uploads.length === 0) return () => null;
    const files = bucket();
    const sent = new Set<string>();
    await Promise.all(
      uploads.map(async (path) => {
        // A file that isn't there is false, with its 404 as the error; any
        // other failure throws.
        try {
          if ((await files.exists(path)).data === true) sent.add(path);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`Storage couldn't check an upload: ${reason}`);
        }
      }),
    );
    return (path, purpose) => {
      if (!uploads.includes(path) || uploadPurposeAt(path) !== purpose) return null;
      return sent.has(path) ? { publicUrl: files.getPublicUrl(path).data.publicUrl } : "waiting";
    };
  }

  async function removeImages(srcs: readonly string[]): Promise<void> {
    let paths: string[];
    try {
      const { supabaseUrl } = connect();
      paths = srcs.flatMap((src) => bucketObjectPath(src, supabaseUrl) ?? []);
    } catch (error) {
      console.error("Couldn't reach Storage after a save to delete the images it removed:", error);
      return;
    }
    if (paths.length === 0) return;
    try {
      const { error } = await bucket().remove(paths);
      if (error) throw error;
    } catch (error) {
      const which = paths.length === 1 ? "1 image" : `${paths.length} images`;
      const stays = paths.length === 1 ? "it stays" : "they stay";
      console.error(
        `Couldn't delete ${which} from Storage after a save; ${stays} in the bucket:`,
        paths,
        error,
      );
    }
  }

  async function createContentUpload(
    actor: StaffActor | null,
    request: ContentUploadRequest,
  ): Promise<AdminResult<ContentUploadTicket>> {
    if (!actor) {
      return { ok: false, error: { kind: "forbidden", message: "SIGN IN TO UPLOAD FILES" } };
    }
    const parsed = contentUploadRequestSchema.safeParse(request);
    if (!parsed.success) return { ok: false, error: invalidInput(parsed.error) };

    const asked = parsed.data;
    const { contentType, path } =
      asked.purpose === "card-image"
        ? {
            contentType: asked.contentType,
            path: `card-images/${crypto.randomUUID()}.${CARD_IMAGE_EXTENSIONS[asked.contentType]}`,
          }
        : {
            contentType: CONTENT_UPLOADS[asked.purpose].contentType,
            path: `imports/${crypto.randomUUID()}.${CONTENT_UPLOADS[asked.purpose].extension}`,
          };
    const { data, error } = await contentBucket().createSignedUploadUrl(path);
    if (error) throw new Error(`Storage couldn't make an upload URL: ${error.message}`);
    return {
      ok: true,
      value: { uploadUrl: data.signedUrl, path, contentType },
      tags: [],
    };
  }

  const contentFiles: ContentFiles = {
    async readUpload(path, purpose) {
      if (!isContentUploadPath(path, purpose)) return null;
      const files = contentBucket();
      // A file that isn't there is false, with its 404 as the error.
      const exists = await files.exists(path).catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Storage couldn't check an upload: ${reason}`);
      });
      if (exists.data !== true) return null;
      const { data, error } = await files.download(path);
      if (error) throw new Error(`Storage couldn't read an upload: ${error.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },
    async read(path) {
      if (!isStoredImagePath(path)) return null;
      const files = contentBucket();
      // A file that isn't there is false, with its 404 as the error.
      const exists = await files.exists(path).catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Storage couldn't check a card image: ${reason}`);
      });
      if (exists.data !== true) return null;
      const { data, error } = await files.download(path);
      if (error) throw new Error(`Storage couldn't read a card image: ${error.message}`);
      const bytes = new Uint8Array(await data.arrayBuffer());
      // Its type from its first bytes, so only an image is ever sent as one.
      const contentType = CARD_IMAGE_TYPES.find((type) => hasFileSignature(bytes, type));
      return contentType ? { contentType, bytes } : null;
    },
    async put(path, bytes, contentType) {
      const { error } = await contentBucket().upload(path, bytes, { contentType, upsert: false });
      if (error) throw new Error(`Storage couldn't store a card image: ${error.message}`);
    },
    async signedUrls(paths, seconds) {
      const wanted = [...new Set(paths)].filter(isStoredImagePath);
      if (wanted.length === 0) return {};
      const { data, error } = await contentBucket().createSignedUrls(wanted, seconds);
      if (error) throw new Error(`Storage couldn't sign card images: ${error.message}`);
      // A file that's gone comes back with its own error, and gets no URL.
      return Object.fromEntries(
        data.flatMap(({ path, signedUrl, error: missing }) =>
          path && !missing ? [[path, signedUrl]] : [],
        ),
      );
    },
    async remove(paths) {
      if (paths.length === 0) return;
      try {
        const { error } = await contentBucket().remove([...paths]);
        if (error) throw error;
      } catch (error) {
        console.error("Couldn't delete files from the content bucket; they stay:", paths, error);
      }
    },
  };

  async function createReviewerPdfUpload(
    actor: StaffActor | null,
    request: ReviewerPdfUploadRequest,
  ): Promise<AdminResult<ReviewerPdfUploadTicket>> {
    if (!actor) {
      return { ok: false, error: { kind: "forbidden", message: "SIGN IN TO UPLOAD FILES" } };
    }
    const parsed = reviewerPdfUploadRequestSchema.safeParse(request);
    if (!parsed.success) return { ok: false, error: invalidInput(parsed.error) };

    // A new Reviewer PDF's id names the file, which its record claims once it's there.
    const path = originalPath(crypto.randomUUID());
    const { client, supabaseUrl } = connect();
    const { data, error } = await client.storage
      .from(REVIEWER_PDFS_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(`Storage couldn't make an upload URL: ${error.message}`);
    return {
      ok: true,
      value: {
        method: "tus",
        endpoint: `${supabaseUrl}${RESUMABLE_UPLOAD}`,
        headers: {
          "x-signature": data.token,
          ...(publishableKey ? { apikey: publishableKey } : {}),
        },
        metadata: {
          bucketName: REVIEWER_PDFS_BUCKET,
          objectName: path,
          contentType: parsed.data.contentType,
          cacheControl: "3600",
        },
        path,
      },
      tags: [],
    };
  }

  /** Whether a file is in the Reviewer PDFs bucket; throws, saying what was checked, when Storage can't say. */
  async function inPdfBucket(path: string, what: string): Promise<boolean> {
    // A file that isn't there is false, with its 404 as the error.
    const exists = await pdfBucket()
      .exists(path)
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Storage couldn't check ${what}: ${reason}`);
      });
    return exists.data === true;
  }

  const reviewerPdfFiles: ReviewerPdfFiles = {
    async claimUpload(path) {
      const id = idOfOriginal(path);
      if (!id) return null;
      if (!(await inPdfBucket(path, "an upload"))) return "waiting";
      const { data, error } = await pdfBucket().info(path);
      if (error) throw new Error(`Storage couldn't read an upload's size: ${error.message}`);
      if (typeof data.size !== "number") throw new Error("Storage couldn't read an upload's size");
      return { id, size: data.size };
    },
    async readOriginal(id) {
      const path = originalPath(id);
      if (!(await inPdfBucket(path, "a Reviewer PDF"))) return null;
      const { data, error } = await pdfBucket().download(path);
      if (error) throw new Error(`Storage couldn't read a Reviewer PDF: ${error.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },
    async putPage(id, page, image) {
      const { error } = await pdfBucket().upload(pagePath(id, page), image, {
        contentType: "image/webp",
        upsert: true,
      });
      if (error) throw new Error(`Storage couldn't store a page image: ${error.message}`);
    },
    async readPage(id, page) {
      const path = pagePath(id, page);
      if (!(await inPdfBucket(path, "a page image"))) return null;
      const { data, error } = await pdfBucket().download(path);
      if (error) throw new Error(`Storage couldn't read a page image: ${error.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(id, pageCount) {
      const paths = reviewerPdfPaths(id, pageCount);
      try {
        const files = pdfBucket();
        for (let start = 0; start < paths.length; start += REMOVE_BATCH) {
          const { error } = await files.remove(paths.slice(start, start + REMOVE_BATCH));
          if (error) throw error;
        }
      } catch (error) {
        console.error(
          "Couldn't delete a Reviewer PDF's files; they stay in the bucket:",
          id,
          error,
        );
      }
    },
  };

  return {
    createUpload,
    createContentUpload,
    createReviewerPdfUpload,
    lookupUploads,
    removeImages,
    contentFiles,
    reviewerPdfFiles,
  };
}

/** The Storage arm on this server's Storage (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY). */
export const storageArm = createStorageArm(getStorage);
