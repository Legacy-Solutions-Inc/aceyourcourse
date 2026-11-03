import { isDatabaseConfigured } from "@/env.server";
import type { AdminResult, StaffActor } from "@/services/admin.types";
import * as mockImpl from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";
import type { UploadRequest, UploadTicket } from "@/services/uploads.types";

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
}

const impl: UploadService = isDatabaseConfigured ? storageArm : mockImpl;

export const createUpload = impl.createUpload;
