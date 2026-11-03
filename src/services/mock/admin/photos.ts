import { PHOTO_NOT_UPLOADED, WAIT_FOR_UPLOADS } from "@/services/admin.schema";
import type { AdminError } from "@/services/admin.types";
import type { ProductPhoto } from "@/services/catalogue.types";
import { getSampleStore } from "@/services/mock/sample-store";
import { sampleUploadAt } from "@/services/uploads.mock";
import type { UploadLookup } from "@/services/uploads.types";

// The sample arm's Photos area: a Product's photos as its editor saves them
// (spec, Phase 2 → Products: Photos). The editor sends them in order, the
// first the cover, each one a photo the Product already has (its src) or a
// new upload (the path the upload seam gave it). Alt text is generated on
// every save, so it follows the name and the order.

/**
 * What a save finds at an upload's path: the store's own lookup when it has
 * one (Storage's, in the Admin's database arm), or else the sample uploads'.
 */
export const uploadAt: UploadLookup = (path, purpose) => {
  const { uploadAt: lookup } = getSampleStore();
  return lookup ? lookup(path, purpose) : sampleUploadAt(path, purpose);
};

/** Pure: a photo's alt text, as the seed has it: "{full name}, photo 2 of 8". */
export function photoAlt(title: string, index: number, count: number): string {
  return `${title}, photo ${index + 1} of ${count}`;
}

/**
 * The photos a save gives a Product: each of its own photos kept, and each
 * finished upload at its public URL, with generated alt text. Refused when a
 * photo is neither (a path the Admin didn't upload, or another Product's
 * photo), or when an upload's file hasn't arrived yet.
 */
export function resolveProductPhotos(
  refs: readonly string[],
  current: readonly ProductPhoto[],
  title: string,
): { ok: true; photos: ProductPhoto[] } | { ok: false; error: AdminError } {
  const srcs: string[] = [];
  let waiting = false;
  for (const ref of refs) {
    if (current.some((photo) => photo.src === ref)) {
      srcs.push(ref);
      continue;
    }
    const upload = uploadAt(ref, "product-photo");
    if (upload === null) {
      return {
        ok: false,
        error: { kind: "invalid", fieldErrors: { photos: [PHOTO_NOT_UPLOADED] } },
      };
    }
    if (upload === "waiting") waiting = true;
    else srcs.push(upload.publicUrl);
  }
  if (waiting) {
    return { ok: false, error: { kind: "invalid", fieldErrors: {}, formError: WAIT_FOR_UPLOADS } };
  }
  const unique = [...new Set(srcs)];
  return {
    ok: true,
    photos: unique.map((src, index) => ({ src, alt: photoAlt(title, index, unique.length) })),
  };
}
