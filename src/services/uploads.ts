import { isDatabaseConfigured } from "@/env.server";
import type { CardImageType } from "@/lib/cards/card-rules";
import type { AdminResult, StaffActor } from "@/services/admin.types";
import * as mockImpl from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";
import type {
  ContentUploadPurpose,
  ContentUploadRequest,
  ContentUploadTicket,
  UploadRequest,
  UploadTicket,
} from "@/services/uploads.types";

// ─────────────────────────────────────────────────────────────────────────────
// Upload Service Seam (CONVENTIONS §3; spec, Phase 2 → Seams: Image upload).
// The browser sends files straight to storage, which avoids the request size
// limits on Server Actions and Vercel functions: a Staff-checked Server Action
// asks this seam for a one-time upload URL, the browser PUTs the file there,
// and the save records the file's path. Like src/services/admin.ts, this
// module is a thin SELECTOR: Supabase Storage (uploads.storage.ts, ticket 17)
// when the database is configured, as the Admin seam's database arm is, and
// otherwise the sample arm, a development-only route held in memory
// (/api/dev/uploads/[id]).
//
// Private uploads (Phase 3, ticket 06) work the same way, into the private
// content bucket: an Editor's card import sends its CSV and zip there, and
// only the server reads them back (ContentFiles), never through a public URL.
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadService {
  /**
   * A one-time upload URL for one JPEG, PNG or WebP of up to 10 MB, for any
   * Staff User. Someone signed out (null) is refused, as is any other type or
   * size, with the field's message. Clears no cache tags: nothing is live
   * until a save records the path. Storage throws "Storage isn't configured
   * on this server." when the server has no secret key.
   */
  createUpload(
    actor: StaffActor | null,
    request: UploadRequest,
  ): Promise<AdminResult<UploadTicket>>;
  /**
   * A one-time upload URL for an import's CSV (up to 10 MB) or zip of images
   * (up to 200 MB) in the private content bucket, for any Staff User. It
   * gives no public URL. Someone signed out is refused, as is a file too big
   * for its purpose, with the field's message. Clears no cache tags.
   */
  createContentUpload(
    actor: StaffActor | null,
    request: ContentUploadRequest,
  ): Promise<AdminResult<ContentUploadTicket>>;
}

/**
 * The private content bucket, as the Admin's card import uses it on the
 * server (ticket 06). Never handed to the browser.
 */
export interface ContentFiles {
  /**
   * The file of a private upload of this purpose, or null when the path isn't
   * one, or its file hasn't arrived. Throws when Storage can't say.
   */
  readUpload(path: string, purpose: ContentUploadPurpose): Promise<Uint8Array | null>;
  /** Stores a card image at its path. Throws when it can't. */
  put(path: string, bytes: Uint8Array, contentType: CardImageType): Promise<void>;
  /** Deletes these files, card images or uploads. Logs a failure, and never throws. */
  remove(paths: readonly string[]): Promise<void>;
}

const impl: UploadService = isDatabaseConfigured ? storageArm : mockImpl;

export const createUpload = impl.createUpload;
export const createContentUpload = impl.createContentUpload;
