import type { UploadService } from "@/services/uploads";
import * as sampleArm from "@/services/uploads.mock";
import type { UploadContentType, UploadTicket } from "@/services/uploads.types";
import { resetSampleStore } from "@/services/mock/sample-store";

/**
 * The upload seam's arms, for `describe.each(UPLOAD_ARMS)` (CONVENTIONS §6).
 * Stage A has the sample arm only; ticket 17 adds Supabase Storage here.
 *
 * Besides the arm, each entry sends a file to a ticket's upload URL as the
 * browser does, and reads back what was stored there.
 */
export interface UploadArm {
  name: string;
  seam: UploadService;
  reset(): Promise<void>;
  /** PUTs the bytes to the ticket's upload URL, as the browser does. True when it was stored. */
  send(ticket: UploadTicket, contentType: string, bytes: Uint8Array): Promise<boolean>;
  /** The file stored at the ticket's public URL, or null. */
  read(ticket: UploadTicket): Promise<{ contentType: UploadContentType; bytes: Uint8Array } | null>;
}

/** The upload id and one-time token in a sample upload URL. */
function sampleUrlParts(ticket: UploadTicket) {
  const url = new URL(ticket.uploadUrl, "http://localhost");
  return { id: url.pathname.split("/").at(-1) ?? "", token: url.searchParams.get("token") ?? "" };
}

export const UPLOAD_ARMS: UploadArm[] = [
  {
    name: "sample data",
    seam: sampleArm,
    reset: async () => {
      resetSampleStore();
    },
    send: async (ticket, contentType, bytes) => {
      const { id, token } = sampleUrlParts(ticket);
      const answer = await sampleArm.receiveSampleUpload(id, token, {
        contentType,
        contentLength: bytes.byteLength,
        body: async () => bytes,
      });
      return answer === "stored";
    },
    read: async (ticket) => sampleArm.readSampleUpload(sampleUrlParts(ticket).id),
  },
];
