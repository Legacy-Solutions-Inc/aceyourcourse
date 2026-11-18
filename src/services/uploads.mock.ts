import { timingSafeEqual } from "node:crypto";

import type { CardImageType } from "@/lib/cards/card-rules";
import { hasFileSignature } from "@/lib/file-signature";
import { paths } from "@/paths";
import { invalidInput } from "@/services/admin.schema";
import type { AdminResult, StaffActor } from "@/services/admin.types";
import { getSampleStore, type SampleUpload } from "@/services/mock/sample-store";
import type { ContentFiles } from "@/services/uploads";
import {
  CONTENT_UPLOAD_PURPOSES,
  CONTENT_UPLOADS,
  type ContentUploadPurpose,
  type ContentUploadRequest,
  contentUploadRequestSchema,
  type ContentUploadTicket,
  UPLOAD_CONTENT_TYPES,
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
//
// A private upload (an import's CSV or zip, ticket 06) is kept the same way,
// but the route never serves it: only the server reads it back. Card images
// go to the sample data's private content bucket (sampleContentFiles).
// ─────────────────────────────────────────────────────────────────────────────

const PATH_PREFIX = "uploads/";

const isContentPurpose = (purpose: SampleUpload["purpose"]): purpose is ContentUploadPurpose =>
  CONTENT_UPLOAD_PURPOSES.some((candidate) => candidate === purpose);

const isUploadContentType = (type: SampleUpload["contentType"]): type is UploadContentType =>
  UPLOAD_CONTENT_TYPES.some((candidate) => candidate === type);

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

/** A one-time URL for a private upload, kept like any other but never served by the route. */
export async function createContentUpload(
  actor: StaffActor | null,
  request: ContentUploadRequest,
): Promise<AdminResult<ContentUploadTicket>> {
  if (!actor)
    return { ok: false, error: { kind: "forbidden", message: "SIGN IN TO UPLOAD FILES" } };
  const parsed = contentUploadRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, error: invalidInput(parsed.error) };

  const asked = parsed.data;
  const { purpose, size } = asked;
  // A card's image is sent as the type the browser said; an import's file as its purpose's type.
  const contentType =
    asked.purpose === "card-image" ? asked.contentType : CONTENT_UPLOADS[asked.purpose].contentType;
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
  return {
    ok: true,
    value: {
      uploadUrl: `${paths.admin.sampleUpload(upload.id)}?token=${encodeURIComponent(upload.token)}`,
      path: pathOf(upload.id),
      contentType,
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
  if (!hasFileSignature(bytes, upload.contentType)) return "not-an-image";

  // Read again: the store may have been reset, or the file sent twice, meanwhile.
  const store = getSampleStore();
  const current = store.uploads[id];
  if (!current) return "not-found";
  if (current.bytes) return "already-uploaded";
  store.uploads = { ...store.uploads, [id]: { ...current, bytes } };
  return "stored";
}

/**
 * An uploaded file, for the route's GET, or null when there's none (yet). A
 * private upload is never served: it reads as if it weren't there.
 */
export function readSampleUpload(
  id: string,
): { contentType: UploadContentType; bytes: Uint8Array } | null {
  const upload = getSampleStore().uploads[id];
  if (!upload?.bytes || isContentPurpose(upload.purpose)) return null;
  const { contentType } = upload;
  return isUploadContentType(contentType) ? { contentType, bytes: upload.bytes } : null;
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

/**
 * The sample data's private content bucket (ticket 06), for the Admin's card
 * import and card editor: a private upload's file, read back by its path and
 * purpose, and the card images, by path. Nothing here is ever served by the
 * upload route.
 */
export const sampleContentFiles: ContentFiles = {
  async readUpload(path, purpose) {
    if (!path.startsWith(PATH_PREFIX)) return null;
    const upload = getSampleStore().uploads[path.slice(PATH_PREFIX.length)];
    return upload?.purpose === purpose && upload.bytes ? upload.bytes : null;
  },
  async read(path) {
    const file = getSampleStore().contentFiles[path];
    return file ? { contentType: file.contentType, bytes: file.bytes } : null;
  },
  async put(path: string, bytes: Uint8Array, contentType: CardImageType) {
    const store = getSampleStore();
    store.contentFiles = { ...store.contentFiles, [path]: { contentType, bytes } };
  },
  async remove(paths) {
    const store = getSampleStore();
    const files = { ...store.contentFiles };
    const uploads = { ...store.uploads };
    for (const path of paths) {
      delete files[path];
      if (path.startsWith(PATH_PREFIX)) {
        const id = path.slice(PATH_PREFIX.length);
        if (uploads[id] && isContentPurpose(uploads[id].purpose)) delete uploads[id];
      }
    }
    store.contentFiles = files;
    store.uploads = uploads;
  },
};
