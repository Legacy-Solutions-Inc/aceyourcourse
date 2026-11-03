import type { UploadRequest } from "@/services/uploads.types";

import { imageBytes } from "./image-bytes";
import { UPLOAD_ARMS } from "./upload-arms";

/**
 * Uploads a PNG through the upload seam's sample arm, as the photo strip does.
 * Both Admin arms use it: uploads stay in memory until ticket 17.
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
    { purpose, contentType: "image/png", size: bytes.byteLength },
  );
  if (!created.ok) throw new Error("The upload was refused");
  if (send && !(await uploads.send(created.value, "image/png", bytes))) {
    throw new Error("The file wasn't stored");
  }
  return { path: created.value.path, publicUrl: created.value.publicUrl };
}
