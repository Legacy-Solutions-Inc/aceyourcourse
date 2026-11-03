import type { UploadRequest } from "@/services/uploads.types";

import { imageBytes } from "./image-bytes";
import { UPLOAD_ARMS } from "./upload-arms";

/**
 * Uploads a PNG through the upload seam's sample arm, as the photo strip does.
 * The sample arm uses it, and the database arm when the database project has
 * no Storage (test/admin-database.ts).
 */
export async function uploadSamplePhoto({
  send = true,
  purpose = "product-photo",
}: { send?: boolean; purpose?: UploadRequest["purpose"] } = {}) {
  const [uploads] = UPLOAD_ARMS;
  if (!uploads) throw new Error("No upload arm");
  const bytes = imageBytes("image/png");
  const created = await uploads.seam.createUpload(
    { email: "content@aceyourcourse.ph", name: "AYC Content Team", role: "editor" },
    // A share image is always for an Exam; the sample arm files it by id anyway.
    {
      purpose,
      owner: purpose === "share-image" ? "CE" : undefined,
      contentType: "image/png",
      size: bytes.byteLength,
    },
  );
  if (!created.ok) throw new Error("The upload was refused");
  if (send && !(await uploads.send(created.value, "image/png", bytes))) {
    throw new Error("The file wasn't stored");
  }
  return { path: created.value.path, publicUrl: created.value.publicUrl };
}
