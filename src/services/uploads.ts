import { isDatabaseConfigured } from "@/env.server";
import type { CardImageType } from "@/lib/cards/card-rules";
import type { AdminResult, CardImageFile, StaffActor } from "@/services/admin.types";
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
   * (up to 200 MB), or a card's back image (a JPEG, PNG or WebP of up to
   * 5 MB, ticket 07), in the private content bucket, for any Staff User. It
   * gives no public URL. Someone signed out is refused, as is a file of the
   * wrong type or too big for its purpose, with the field's message. Clears
   * no cache tags.
   */
  createContentUpload(
    actor: StaffActor | null,
    request: ContentUploadRequest,
  ): Promise<AdminResult<ContentUploadTicket>>;
}

/**
 * The private content bucket, as the Admin's imports (tickets 06 and 09), card
 * editor (ticket 07) and quiz screen (ticket 09) use it on the server, and the
 * Member seam signs card images from (ticket 08). Never handed to the browser.
 * A quiz figure has a card image's rules, so the same calls serve both.
 */
export interface ContentFiles {
  /**
   * The file of a private upload of this purpose, or null when the path isn't
   * one, or its file hasn't arrived. Throws when Storage can't say.
   */
  readUpload(path: string, purpose: ContentUploadPurpose): Promise<Uint8Array | null>;
  /**
   * A stored card image (decks/<deck>/<file>) or quiz figure
   * (quizzes/<quiz>/<file>), with its type, for Staff to see through the
   * Admin's image routes (tickets 07 and 09), or null when there's none.
   * Throws when Storage can't say.
   */
  read(path: string): Promise<CardImageFile | null>;
  /** Stores a card image at its path. Throws when it can't. */
  put(path: string, bytes: Uint8Array, contentType: CardImageType): Promise<void>;
  /** Deletes these files, card images or uploads. Logs a failure, and never throws. */
  remove(paths: readonly string[]): Promise<void>;
  /**
   * Signed URLs for stored card images (or quiz figures), by path, that stop
   * working after `seconds` (ticket 08): only the Member seam asks, and only
   * for a deck (or quiz) the access decision allowed. A path that isn't a
   * stored image's, or whose file is gone, gets none. Throws when Storage
   * can't sign them.
   */
  signedUrls(paths: readonly string[], seconds: number): Promise<Record<string, string>>;
}

const impl: UploadService = isDatabaseConfigured ? storageArm : mockImpl;

export const createUpload = impl.createUpload;
export const createContentUpload = impl.createContentUpload;
