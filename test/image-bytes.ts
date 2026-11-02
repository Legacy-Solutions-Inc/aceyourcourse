import type { UploadContentType } from "@/services/uploads.types";

/** Each accepted image type's first bytes (its "magic bytes"). */
const SIGNATURES: Record<UploadContentType, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff, 0xe0],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // RIFF, a 4-byte length, then WEBP.
  "image/webp": [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
};

/**
 * A file that starts like an image of this type, padded to `size` bytes. Enough
 * for the upload checks, which read the type's first bytes, not the picture.
 */
export function imageBytes(contentType: UploadContentType, size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(SIGNATURES[contentType].slice(0, size));
  return bytes;
}

/** A file that isn't an image at all, whatever it claims to be. */
export function textBytes(size = 64): Uint8Array {
  return new TextEncoder().encode("not an image ".repeat(Math.ceil(size / 13))).slice(0, size);
}
