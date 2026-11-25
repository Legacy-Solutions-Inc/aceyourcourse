import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizzes/quiz-rules";
import { asc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { getStorage, isStorageConfigured } from "@/lib/supabase/admin";
import { databaseArm } from "@/services/admin.db";
import { deniedSignInFromRow, staffActivityFromRow } from "@/services/admin.rows";
import {
  accessPassGrantToRow,
  accessPassToRow,
  cardFromRow,
  contentFromRows,
  questionFromRow,
} from "@/services/content.rows";
import { databaseArm as memberDatabaseArm } from "@/services/member.db";
import { orderFromRow, orderToRow } from "@/services/orders.rows";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { sampleContentFiles, sampleReviewerPdfFiles } from "@/services/uploads.mock";
import { CONTENT_BUCKET, storageArm } from "@/services/uploads.storage";
import type { UploadRequest } from "@/services/uploads.types";

import {
  type AdminArm,
  byCardAndMember,
  byDeckAndPosition,
  byId,
  byQuizAndPosition,
  byReference,
} from "./admin-arms";
import {
  type CardImageUpload,
  declaredSize,
  IMAGE_UPLOADER,
  uploadSampleCardImage,
} from "./card-images";
import {
  IMPORT_UPLOADER,
  type ImportFiles,
  uploadContent,
  uploadSampleImport,
} from "./import-files";
import { loadTestCatalogue } from "./catalogue-database";
import { newContent } from "./content-inputs";
import { imageBytes } from "./image-bytes";
import { SHARE_IMAGE_OWNERS, uploadSamplePhoto } from "./sample-photo";
import {
  sampleReviewerPdfFile,
  storageReviewerPdfFile,
  uploadSampleReviewerPdf,
  uploadStorageReviewerPdf,
} from "./reviewer-pdf-uploads";
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
  const create = (purpose: "import-csv" | "import-zip", size: number) =>
    storageArm.createContentUpload(IMPORT_UPLOADER, { purpose, size });
  const put = async (ticket: { uploadUrl: string; contentType: string }, bytes: Uint8Array) =>
    (await putFile(ticket.uploadUrl, ticket.contentType, bytes)).ok;
  return {
    csv: await uploadContent(create, put, "import-csv", csv, send),
    zip: zip ? await uploadContent(create, put, "import-zip", zip, send) : null,
  };
}

/**
 * Uploads a card image to local Supabase's private content bucket, as the card
 * form does: a one-time URL for the declared size, then the file as given,
 * which the bucket takes whatever it is.
 */
async function uploadStorageCardImage(
  bytes: Uint8Array,
  { contentType = "image/png", send = true }: CardImageUpload = {},
): Promise<string> {
  const created = await storageArm.createContentUpload(IMAGE_UPLOADER, {
    purpose: "card-image",
    contentType,
    size: declaredSize(bytes),
  });
  if (!created.ok) throw new Error("The card image upload was refused");
  if (send && !(await putFile(created.value.uploadUrl, contentType, bytes)).ok) {
    throw new Error("The card image wasn't stored");
  }
  return created.value.path;
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
  member: memberDatabaseArm,
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
  deleteMemberElsewhere: async (userId) => {
    // Their records cascade; their Privacy Requests' user_id is emptied.
    await getDb().delete(schema.members).where(eq(schema.members.userId, userId));
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
      await getDb()
        .insert(schema.quizzes)
        .values({ id, topicId, visibility, freePreview, ...DEFAULT_QUIZ_SETTINGS });
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
  uploadCardImage: isStorageConfigured ? uploadStorageCardImage : uploadSampleCardImage,
  putCardMark: async ({ userId, cardId, verdict, markedAt }) => {
    // A Card Mark is a Member's: their row first, if the test hasn't made one.
    await getDb()
      .insert(schema.members)
      .values({ userId, email: `${userId.slice(0, 8)}@example.com`, joinedAt: new Date() })
      .onConflictDoNothing();
    await getDb()
      .insert(schema.cardMarks)
      .values({ userId, cardId, verdict, markedAt: new Date(markedAt) });
  },
  cardMarks: async () =>
    byCardAndMember(
      (await getDb().select().from(schema.cardMarks)).map((row) => ({
        userId: row.userId,
        cardId: row.cardId,
        verdict: row.verdict,
        markedAt: row.markedAt.toISOString(),
      })),
    ),
  quizzes: async () =>
    byId(
      contentFromRows({
        topics: [],
        decks: [],
        quizzes: await getDb().select().from(schema.quizzes),
        reviewerPdfs: [],
      }).quizzes,
    ),
  questions: async () =>
    byQuizAndPosition((await getDb().select().from(schema.questions)).map(questionFromRow)),
  // Storage when the database project has it, as the database arm does.
  uploadReviewerPdf: isStorageConfigured ? uploadStorageReviewerPdf : uploadSampleReviewerPdf,
  reviewerPdfFile: isStorageConfigured ? storageReviewerPdfFile : sampleReviewerPdfFile,
  reviewerPdfFiles: isStorageConfigured ? storageArm.reviewerPdfFiles : sampleReviewerPdfFiles,
  setReviewerPdfUpload: async (id, change) => {
    const { heartbeatAt, uploadedAt, ...rest } = change;
    await getDb()
      .update(schema.reviewerPdfs)
      .set({
        ...rest,
        ...(heartbeatAt === undefined
          ? {}
          : { heartbeatAt: heartbeatAt === null ? null : new Date(heartbeatAt) }),
        ...(uploadedAt === undefined ? {} : { uploadedAt: new Date(uploadedAt) }),
      })
      .where(eq(schema.reviewerPdfs.id, id));
  },
  putAccessPass: async (pass, grants = []) => {
    await getDb().insert(schema.accessPasses).values(accessPassToRow(pass));
    if (grants.length) {
      await getDb().insert(schema.accessPassGrants).values(grants.map(accessPassGrantToRow));
    }
  },
  putOrder: async (order) => {
    await getDb().insert(schema.orders).values(orderToRow(order));
  },
  orders: async () => byReference((await getDb().select().from(schema.orders)).map(orderFromRow)),
  memberRecords: async (userId) => {
    const db = getDb();
    const count = async (table: PgTable & { userId: AnyPgColumn }) =>
      Number(
        (
          await db
            .select({ n: sql<number>`count(*)` })
            .from(table)
            .where(eq(table.userId, userId))
        )[0]?.n ?? 0,
      );
    return {
      member: await count(schema.members),
      consents: await count(schema.memberConsents),
      targetExams: await count(schema.memberTargetExams),
      activeDevice: await count(schema.memberActiveDevices),
      deviceSwitches: await count(schema.memberDeviceSwitches),
      accessPasses: await count(schema.accessPasses),
      accessPassGrants: await count(schema.accessPassGrants),
      notices: await count(schema.memberNotices),
      cardMarks: await count(schema.cardMarks),
      studyDays: await count(schema.studyDays),
      deckPositions: await count(schema.deckPositions),
      quizAttempts: await count(schema.quizAttempts),
      reviewerPageViews: await count(schema.reviewerPageViews),
      readerPositions: await count(schema.readerPositions),
      privacyRequests: await count(schema.privacyRequests),
    };
  },
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
