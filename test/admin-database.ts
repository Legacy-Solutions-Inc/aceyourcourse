import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/supabase/admin";
import { databaseArm } from "@/services/admin.db";
import { deniedSignInFromRow, staffActivityFromRow } from "@/services/admin.rows";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { resetSampleStore } from "@/services/mock/sample-store";
import { storageArm } from "@/services/uploads.storage";
import type { UploadRequest } from "@/services/uploads.types";

import type { AdminArm } from "./admin-arms";
import { loadTestCatalogue } from "./catalogue-database";
import { imageBytes } from "./image-bytes";
import { SHARE_IMAGE_OWNERS, uploadSamplePhoto } from "./sample-photo";
import { putFile } from "./storage-database";

/**
 * Uploads a PNG through the upload seam's Storage arm, as the photo strip
 * does: to local Supabase's bucket, which the database arm then checks.
 */
async function uploadStoragePhoto({
  send = true,
  purpose = "product-photo",
}: { send?: boolean; purpose?: UploadRequest["purpose"] } = {}) {
  const bytes = imageBytes("image/png");
  const created = await storageArm.createUpload(
    { email: "content@aceyourcourse.ph", name: "AYC Content Team", role: "editor" },
    {
      purpose,
      owner: SHARE_IMAGE_OWNERS[purpose] ?? "prd-001",
      contentType: "image/png",
      size: bytes.byteLength,
    },
  );
  if (!created.ok) throw new Error("The upload was refused");
  if (send && !(await putFile(created.value.uploadUrl, "image/png", bytes)).ok) {
    throw new Error("The file wasn't stored");
  }
  return { path: created.value.path, publicUrl: created.value.publicUrl };
}

/**
 * The Admin seam's database arm in the database project (`pnpm test:db`),
 * where vitest.config.ts points DATABASE_URL at TEST_DATABASE_URL, so the
 * seams and these helpers read and write the test database. Each reset loads
 * the seed and the sample staff list, as `pnpm db:reset` does.
 */
export const DATABASE_ARM: AdminArm = {
  name: "database",
  seam: databaseArm,
  reset: async (edit) => {
    const seed = structuredClone(CATALOGUE_SEED);
    edit?.(seed);
    // Without Storage, the database arm finds uploads in the sample data: start them again too.
    resetSampleStore();
    await loadTestCatalogue(getDb(), seed);
  },
  deleteProductElsewhere: async (id) => {
    // Its Reviews, photos and Listings go with it (the tables cascade).
    await getDb().delete(schema.products).where(eq(schema.products.id, id));
  },
  deleteReviewElsewhere: async (id) => {
    await getDb().delete(schema.reviews).where(eq(schema.reviews.id, id));
  },
  // Storage when the database project has it (TEST_SUPABASE_SECRET_KEY), as the database arm does.
  uploadPhoto: isStorageConfigured ? uploadStoragePhoto : uploadSamplePhoto,
  staffActivity: async () =>
    (await getDb().select().from(schema.staffActivity).orderBy(asc(schema.staffActivity.seq))).map(
      staffActivityFromRow,
    ),
  deniedSignIns: async () =>
    (await getDb().select().from(schema.deniedSignIns).orderBy(asc(schema.deniedSignIns.seq))).map(
      deniedSignInFromRow,
    ),
};
