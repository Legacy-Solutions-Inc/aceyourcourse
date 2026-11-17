import { asc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { getStorage, isStorageConfigured } from "@/lib/supabase/admin";
import { databaseArm } from "@/services/admin.db";
import { deniedSignInFromRow, staffActivityFromRow } from "@/services/admin.rows";
import { cardFromRow } from "@/services/content.rows";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { sampleContentFiles } from "@/services/uploads.mock";
import { CONTENT_BUCKET, storageArm } from "@/services/uploads.storage";
import type { UploadRequest } from "@/services/uploads.types";

import { type AdminArm, byDeckAndPosition } from "./admin-arms";
import {
  IMPORT_UPLOADER,
  type ImportFiles,
  uploadContent,
  uploadSampleImport,
} from "./card-import-files";
import { loadTestCatalogue } from "./catalogue-database";
import { newContent } from "./content-inputs";
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

/** Uploads an import's files to local Supabase's private content bucket, as the import screen does. */
async function uploadStorageImport({ csv, zip = null, send = true }: ImportFiles) {
  const create = (purpose: "card-import-csv" | "card-import-zip", size: number) =>
    storageArm.createContentUpload(IMPORT_UPLOADER, { purpose, size });
  const put = async (ticket: { uploadUrl: string; contentType: string }, bytes: Uint8Array) =>
    (await putFile(ticket.uploadUrl, ticket.contentType, bytes)).ok;
  return {
    csv: await uploadContent(create, put, "card-import-csv", csv, send),
    zip: zip ? await uploadContent(create, put, "card-import-zip", zip, send) : null,
  };
}

/** The file at a path in the sample data's private content bucket, or null. */
const getSampleStoreFile = (path: string) => getSampleStore().contentFiles[path]?.bytes ?? null;

/** The file at a path in local Supabase's private content bucket, or null. */
async function storedStorageFile(path: string): Promise<Uint8Array | null> {
  const { data, error } = await getStorage().client.storage.from(CONTENT_BUCKET).download(path);
  return error ? null : new Uint8Array(await data.arrayBuffer());
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
  putContent: async (kind, topicId) => {
    const { id, visibility, status, freePreview } = newContent(topicId);
    if (kind === "deck") {
      await getDb().insert(schema.decks).values({ id, topicId, visibility, freePreview });
    }
    if (kind === "quiz") {
      await getDb().insert(schema.quizzes).values({ id, topicId, visibility, freePreview });
    }
    if (kind === "reviewer-pdf") {
      await getDb().insert(schema.reviewerPdfs).values({ id, topicId, status, freePreview });
    }
    return id;
  },
  // Storage when the database project has it, as the database arm does.
  uploadImport: isStorageConfigured ? uploadStorageImport : uploadSampleImport,
  cards: async () =>
    byDeckAndPosition((await getDb().select().from(schema.cards)).map(cardFromRow)),
  storedFile: isStorageConfigured ? storedStorageFile : async (path) => getSampleStoreFile(path),
  contentFiles: isStorageConfigured ? storageArm.contentFiles : sampleContentFiles,
  // A trigger that refuses every Staff Activity row: the save's last write.
  // The database tests run one file at a time, so no other test meets it.
  breakStaffActivity: async () => {
    await getDb().execute(sql`
      create or replace function public.test_refuse_staff_activity() returns trigger
      language plpgsql as $$ begin raise exception 'Staff Activity can''t be written.'; end $$`);
    await getDb().execute(sql`
      create trigger test_refuse_staff_activity before insert on staff_activity
      for each row execute function public.test_refuse_staff_activity()`);
    return async () => {
      await getDb().execute(
        sql`drop trigger if exists test_refuse_staff_activity on staff_activity`,
      );
      await getDb().execute(sql`drop function if exists public.test_refuse_staff_activity()`);
    };
  },
};
