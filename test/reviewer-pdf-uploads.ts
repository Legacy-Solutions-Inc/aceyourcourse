import { getStorage } from "@/lib/supabase/admin";
import { REVIEWER_PDFS_BUCKET } from "@/lib/reviewer-pdfs/paths";
import type { StaffActor } from "@/services/admin.types";
import { getSampleStore } from "@/services/mock/sample-store";
import { createReviewerPdfUpload as createSampleUpload } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// How the Admin seam's tests upload a Reviewer PDF (ticket 12), as the
// Reviewer PDFs screen does: through the upload seam, to the sample data's
// one-time URL or to local Supabase's private Reviewer PDFs bucket. The file
// arrives as given, whatever it is, as Storage's bucket takes any PDF it's
// sent: what the job then makes of it is the job's own doing.

/** The Staff User who uploads Reviewer PDFs in the tests. */
export const PDF_UPLOADER: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

/** How a test uploads a Reviewer PDF. */
export interface ReviewerPdfUploadOptions {
  /** False: ask for the upload, but never send the file, as when an upload hasn't finished. */
  send?: boolean;
}

const request = (bytes: Uint8Array) =>
  ({ contentType: "application/pdf", size: Math.max(1, bytes.byteLength) }) as const;

/** Uploads a Reviewer PDF to the sample data, and gives the path its record claims. */
export async function uploadSampleReviewerPdf(
  bytes: Uint8Array,
  { send = true }: ReviewerPdfUploadOptions = {},
): Promise<string> {
  const created = await createSampleUpload(PDF_UPLOADER, request(bytes));
  if (!created.ok || created.value.method !== "put") {
    throw new Error("The Reviewer PDF upload was refused");
  }
  if (send) {
    const id = new URL(created.value.uploadUrl, "http://localhost").pathname.split("/").at(-1);
    const store = getSampleStore();
    const upload = id ? store.uploads[id] : undefined;
    if (!id || !upload) throw new Error("The sample upload isn't there");
    store.uploads = { ...store.uploads, [id]: { ...upload, bytes } };
  }
  return created.value.path;
}

/**
 * Uploads a Reviewer PDF to local Supabase's private bucket on the upload's
 * one-time token, and gives the path its record claims. The browser sends it
 * in pieces (TUS); the test sends it whole, on the same token.
 */
export async function uploadStorageReviewerPdf(
  bytes: Uint8Array,
  { send = true }: ReviewerPdfUploadOptions = {},
): Promise<string> {
  const created = await storageArm.createReviewerPdfUpload(PDF_UPLOADER, request(bytes));
  if (!created.ok || created.value.method !== "tus") {
    throw new Error("The Reviewer PDF upload was refused");
  }
  const { path, headers } = created.value;
  if (send) {
    const token = headers["x-signature"] ?? "";
    const { error } = await getStorage()
      .client.storage.from(REVIEWER_PDFS_BUCKET)
      .uploadToSignedUrl(path, token, bytes, { contentType: "application/pdf" });
    if (error) throw new Error(`The Reviewer PDF wasn't stored: ${error.message}`);
  }
  return path;
}

/** The file at a path in the sample data's private Reviewer PDFs bucket, or null. */
export const sampleReviewerPdfFile = async (path: string) =>
  getSampleStore().reviewerPdfFiles[path] ?? null;

/** The file at a path in local Supabase's private Reviewer PDFs bucket, or null. */
export async function storageReviewerPdfFile(path: string): Promise<Uint8Array | null> {
  const { data, error } = await getStorage()
    .client.storage.from(REVIEWER_PDFS_BUCKET)
    .download(path);
  return error ? null : new Uint8Array(await data.arrayBuffer());
}
