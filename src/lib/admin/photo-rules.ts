import { WAIT_FOR_UPLOADS } from "@/services/admin.schema";
import { MAX_UPLOAD_BYTES, uploadRequestSchema } from "@/services/uploads.types";

// The photo strip's rules (spec, Phase 2 → Products: Photos; BUILD-MAP §3.3,
// "PHOTOS · FIRST IS THE COVER"). A file is checked before it's uploaded, and
// the server checks the type and size again. Size and shape are only warned
// about: the photo can still be saved.
//
// The editor's form holds the photos in order as references: a photo the
// Product has (its src, "/…"), a finished upload (the path the upload seam
// gave it), or an upload on its way ("pending:<key>") or failed
// ("failed:<key>"). Only the first two can be saved.

/** The smallest photo that needs no warning, in pixels on each side. */
const GOOD_SIDE = 1000;

const isUploadType = (type: string) =>
  uploadRequestSchema.shape.contentType.safeParse(type).success;

/** Pure: why a chosen file can't be uploaded, naming it, or null when it can. */
export function photoFileRefusal(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!isUploadType(file.type)) return `“${file.name}” isn’t a JPEG, PNG or WebP image.`;
  if (file.size > MAX_UPLOAD_BYTES) return `“${file.name}” is over 10 MB.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

/** Pure: the warning for a photo smaller than 1000 × 1000 or not square, or null. */
export function photoSizeWarning({ width, height }: { width: number; height: number }) {
  const problems = [
    ...(width < GOOD_SIDE || height < GOOD_SIDE ? [`BELOW ${GOOD_SIDE} × ${GOOD_SIDE}`] : []),
    ...(width !== height ? ["NOT SQUARE"] : []),
  ];
  return problems.length > 0 ? [`${width} × ${height}`, ...problems].join(" · ") : null;
}

/** Pure: the line under the strip (mockup 1111). */
export function photoCaption(count: number): string {
  if (count === 0) return "Add photos. Square images work best, at least 1000 × 1000.";
  return `${count} ${count === 1 ? "photo" : "photos"} · drag to reorder`;
}

/** Pure: the photos with one moved to another place. A move off either end changes nothing. */
export function movePhoto<T>(photos: readonly T[], from: number, to: number): T[] {
  const moved = photos[from];
  if (moved === undefined || to < 0 || to >= photos.length || from === to) return [...photos];
  const rest = photos.filter((_, index) => index !== from);
  return [...rest.slice(0, to), moved, ...rest.slice(to)];
}

const PENDING = "pending:";
const FAILED = "failed:";

/** Pure: the form's reference for an upload still on its way. */
export const pendingPhoto = (key: string) => `${PENDING}${key}`;

/** Pure: the form's reference for an upload that failed. */
export const failedPhoto = (key: string) => `${FAILED}${key}`;

/** Pure: the upload a pending or failed reference stands for, or null for any other photo. */
export function uploadKeyOf(photo: string): string | null {
  if (photo.startsWith(PENDING)) return photo.slice(PENDING.length);
  if (photo.startsWith(FAILED)) return photo.slice(FAILED.length);
  return null;
}

/** Pure: whether a photo is an upload on its way, a failed upload, or one that can be saved. */
export function photoState(photo: string): "pending" | "failed" | "ready" {
  if (photo.startsWith(PENDING)) return "pending";
  if (photo.startsWith(FAILED)) return "failed";
  return "ready";
}

export const UPLOAD_FAILED_BLOCKER = "An upload failed. Try it again, or remove it.";

/** Pure: why photos can't be saved yet, an upload on its way or failed, or null. */
export function photoUploadBlocker(photos: readonly string[]): string | null {
  const states = photos.map(photoState);
  if (states.includes("pending")) return WAIT_FOR_UPLOADS;
  if (states.includes("failed")) return UPLOAD_FAILED_BLOCKER;
  return null;
}
