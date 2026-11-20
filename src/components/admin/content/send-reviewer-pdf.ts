import { Upload } from "tus-js-client";

import { putFile } from "@/components/admin/products/put-file";
import { PDF_CONTENT_TYPE } from "@/lib/reviewer-pdfs/pdf-file";
import type { ReviewerPdfUploadTicket } from "@/services/uploads.types";

// The browser's half of a Reviewer PDF upload (ticket 12; spec, Phase 3
// planning decisions → The Reviewer PDF job): the PDF goes straight to
// Storage's private bucket, never through a Server Action or a Vercel
// function, whose request bodies are capped at about 4.5 MB. With Storage
// it's a resumable (TUS) upload: it's sent in pieces, and a dropped
// connection carries on from the last piece Storage has. The sample data
// takes it in one PUT.

/** Supabase's resumable uploads take 6 MB pieces, no other size (Storage → Resumable uploads). */
export const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

/** How long to wait before each retry of a piece that didn't arrive, in ms. */
const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000, 20000];

/** Sends the PDF where the ticket says, reporting how much has been sent (0 to 1). Rejects when it can't. */
export function sendReviewerPdf(
  ticket: ReviewerPdfUploadTicket,
  file: File,
  onProgress: (sent: number) => void,
): Promise<void> {
  if (ticket.method === "put") return putFile(ticket.uploadUrl, file, onProgress, PDF_CONTENT_TYPE);
  return new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: ticket.endpoint,
      headers: ticket.headers,
      metadata: ticket.metadata,
      chunkSize: TUS_CHUNK_BYTES,
      retryDelays: RETRY_DELAYS,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // Each upload is to its own new path on its own token, so an upload
      // left from an earlier visit is never one to carry on.
      storeFingerprintForResuming: false,
      onProgress: (sent, total) => {
        if (total > 0) onProgress(sent / total);
      },
      onSuccess: () => resolve(),
      onError: (error) => reject(error),
    });
    upload.start();
  });
}
