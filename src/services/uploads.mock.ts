import { timingSafeEqual } from "node:crypto";

import { paths } from "@/paths";
import { invalidInput } from "@/services/admin.schema";
import type { AdminResult, StaffActor } from "@/services/admin.types";
import { getSampleStore, type SampleUpload } from "@/services/mock/sample-store";
import {
  type UploadContentType,
  type UploadRequest,
  uploadRequestSchema,
  type UploadTicket,
} from "@/services/uploads.types";

// ─────────────────────────────────────────────────────────────────────────────
// The upload seam's sample arm (CONVENTIONS §3). Each upload is kept in the
// sample store under its id, with a one-time token. The development-only
// route /api/dev/uploads/[id] takes the file once (PUT, with the token) and
// serves it (GET); both go through the functions below. A save records the
// upload's path, which this arm resolves to its public URL.
// ─────────────────────────────────────────────────────────────────────────────

const PATH_PREFIX = "uploads/";

/** Each accepted type's first bytes. WebP is RIFF, a 4-byte length, then WEBP. */
const SIGNATURES: Record<UploadContentType, { at: number; bytes: number[] }[]> = {
  "image/jpeg": [{ at: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/png": [{ at: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  "image/webp": [
    { at: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    { at: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  ],
};

/** Pure: whether the file starts as an image of this type does. */
export function hasImageSignature(bytes: Uint8Array, contentType: UploadContentType): boolean {
  return SIGNATURES[contentType].every(({ at, bytes: expected }) =>
    expected.every((byte, index) => bytes[at + index] === byte),
  );
}

/** A random one-time token, URL-safe. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

/** Compares a sent token with the upload's in constant time. */
function sameToken(sent: string, token: string): boolean {
  const a = Buffer.from(sent);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const pathOf = (id: string) => `${PATH_PREFIX}${id}`;

export async function createUpload(
  actor: StaffActor | null,
  request: UploadRequest,
): Promise<AdminResult<UploadTicket>> {
  if (!actor)
    return { ok: false, error: { kind: "forbidden", message: "SIGN IN TO UPLOAD PHOTOS" } };
  const parsed = uploadRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, error: invalidInput(parsed.error) };

  // What the file is for doesn't matter here: every sample upload is filed by its id.
  const { purpose, contentType, size } = parsed.data;
  const store = getSampleStore();
  const upload: SampleUpload = {
    id: crypto.randomUUID(),
    purpose,
    contentType,
    size,
    token: newToken(),
    bytes: null,
  };
  store.uploads = { ...store.uploads, [upload.id]: upload };
  const publicUrl = paths.admin.sampleUpload(upload.id);
  return {
    ok: true,
    value: {
      uploadUrl: `${publicUrl}?token=${encodeURIComponent(upload.token)}`,
      path: pathOf(upload.id),
      publicUrl,
    },
    tags: [],
  };
}

/** How the sample route answers a PUT. */
export type SampleUploadAnswer =
  | "stored"
  | "not-found"
  | "bad-token"
  | "already-uploaded"
  | "wrong-type"
  | "wrong-size"
  | "not-an-image";

/** A PUT as the route receives it. The body is read only once the headers pass, its length too. */
export interface SampleUploadPut {
  contentType: string | null;
  contentLength: number | null;
  body: () => Promise<Uint8Array>;
}

/**
 * Takes the file sent to an upload's one-time URL. It's stored only when the
 * token is the upload's, nothing has been stored yet, and the file is the
 * declared type and size and really is that type of image. A refused PUT
 * stores nothing and leaves the URL usable.
 */
export async function receiveSampleUpload(
  id: string,
  token: string,
  put: SampleUploadPut,
): Promise<SampleUploadAnswer> {
  const upload = getSampleStore().uploads[id];
  if (!upload) return "not-found";
  if (!sameToken(token, upload.token)) return "bad-token";
  if (upload.bytes) return "already-uploaded";
  if (put.contentType !== upload.contentType) return "wrong-type";
  // The declared length is checked before the body is read, so a PUT can't
  // make the server hold more than the upload's size; one without it is refused.
  if (put.contentLength !== upload.size) return "wrong-size";

  const bytes = await put.body();
  if (bytes.byteLength !== upload.size) return "wrong-size";
  if (!hasImageSignature(bytes, upload.contentType)) return "not-an-image";

  // Read again: the store may have been reset, or the file sent twice, meanwhile.
  const store = getSampleStore();
  const current = store.uploads[id];
  if (!current) return "not-found";
  if (current.bytes) return "already-uploaded";
  store.uploads = { ...store.uploads, [id]: { ...current, bytes } };
  return "stored";
}

/** An uploaded file, for the route's GET, or null when there's none (yet). */
export function readSampleUpload(
  id: string,
): { contentType: UploadContentType; bytes: Uint8Array } | null {
  const upload = getSampleStore().uploads[id];
  return upload?.bytes ? { contentType: upload.contentType, bytes: upload.bytes } : null;
}

/**
 * What a save finds at an upload's path: the file's public URL once it's
 * uploaded, "waiting" while the browser hasn't sent it, or null for a path
 * that isn't an upload of this purpose.
 */
export function sampleUploadAt(
  path: string,
  purpose: UploadRequest["purpose"],
): { publicUrl: string } | "waiting" | null {
  if (!path.startsWith(PATH_PREFIX)) return null;
  const id = path.slice(PATH_PREFIX.length);
  const upload = getSampleStore().uploads[id];
  if (!upload || upload.purpose !== purpose) return null;
  return upload.bytes ? { publicUrl: paths.admin.sampleUpload(id) } : "waiting";
}
