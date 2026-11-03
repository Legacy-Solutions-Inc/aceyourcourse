import "server-only";

import { bucketObjectPath, CATALOGUE_BUCKET } from "@/lib/catalogue-bucket";
import { getStorage, type StorageConnection } from "@/lib/supabase/admin";
import { invalidInput } from "@/services/admin.schema";
import type { AdminResult, StaffActor } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { UploadService } from "@/services/uploads";
import {
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
// ─────────────────────────────────────────────────────────────────────────────

const EXTENSIONS: Record<UploadContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A new Product's photos wait here: it has no id until its first save. */
const NEW_PRODUCT = "new";

const UPLOAD_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const OWNER = UPLOAD_OWNER.source.slice(1, -1);
const EXTENSION = `(?:${Object.values(EXTENSIONS).join("|")})`;

/** Where each kind of upload goes in the bucket. Only uploads are filed this way. */
const UPLOAD_PATHS: Record<UploadRequest["purpose"], RegExp> = {
  "product-photo": new RegExp(`^products/${OWNER}/${UPLOAD_ID}\\.${EXTENSION}$`),
  "share-image": new RegExp(`^exam-pages/${OWNER}/share-${UPLOAD_ID}\\.${EXTENSION}$`),
};

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

/** Every image the catalogue uses: its Products' photos and its Exams' share images. */
function imagesOf(catalogue: CatalogueSeed): string[] {
  return [
    ...catalogue.products.flatMap((product) => product.photos.map((photo) => photo.src)),
    ...catalogue.examPages.flatMap((page) => (page.shareImage ? [page.shareImage] : [])),
  ];
}

/**
 * Pure: the images a save stopped using: a photo taken off its Product, every
 * photo of a deleted Product, and a share image replaced or cleared. An image
 * still used anywhere in the catalogue isn't one.
 */
export function imagesRemoved(before: CatalogueSeed, after: CatalogueSeed): string[] {
  const kept = new Set(imagesOf(after));
  return [...new Set(imagesOf(before))].filter((src) => !kept.has(src));
}

export interface StorageArm extends UploadService {
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

/** The Storage arm, on the Storage `connect` gives; it throws when there's none. */
export function createStorageArm(connect: () => StorageConnection): StorageArm {
  const bucket = () => connect().client.storage.from(CATALOGUE_BUCKET);

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
    const path =
      purpose === "product-photo"
        ? `products/${owner ?? NEW_PRODUCT}/${file}`
        : `exam-pages/${owner}/share-${file}`;
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

  return { createUpload, lookupUploads, removeImages };
}

/** The Storage arm on this server's Storage (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY). */
export const storageArm = createStorageArm(getStorage);
