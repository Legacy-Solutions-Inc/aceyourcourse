import "server-only";

import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";

import { adminWriteLock } from "@/lib/db/admin-locks";
import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { STALE_AFTER_MS } from "@/lib/reviewer-pdfs/job";
import { isStorageConfigured } from "@/lib/supabase/admin";
import { staffActivityToRow } from "@/services/admin.rows";
import type { AdminReviewerPdf } from "@/services/admin.types";
import type { ReviewerPdfUpload } from "@/services/content.types";
import {
  placementOf,
  type ReviewerPdfJob,
  type ReviewerPdfJobs,
  reviewerPdfCalls,
} from "@/services/reviewer-pdfs.core";
import { sampleReviewerPdfFiles } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Reviewer PDFs on Postgres (Phase 3, ticket 12): the shared
// calls (src/services/reviewer-pdfs.core.ts) over the reviewer_pdfs table,
// whose upload and job columns this module alone reads and writes (the
// content's own writes, admin.db.ts, touch only the record's status, Topic
// and Free Preview). Recording and deleting take the content write lock, as
// every content write does, and write the row and its Staff Activity in one
// transaction. Each job change is one conditional UPDATE, made only where
// the row still says what the run expects (Processing, at that count), so
// two runs, a run and a delete, or a run and the cron never both win. Times
// come from the server's clock, never the database's, as the job's rules
// read them.
// Files are in Storage's private Reviewer PDFs bucket, or, without Storage
// (database tests with no secret key), in the sample data's.
// ─────────────────────────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ReviewerPdfRow = typeof schema.reviewerPdfs.$inferSelect;

/** Pure: a row's upload and job, or null for a Reviewer PDF with no upload. */
function uploadOf(row: ReviewerPdfRow): ReviewerPdfUpload | null {
  const { fileName, fileSize, uploadedAt } = row;
  if (fileName === null || fileSize === null || uploadedAt === null) return null;
  return {
    fileName,
    fileSize,
    uploadedAt: uploadedAt.toISOString(),
    pageCount: row.pageCount,
    pagesDone: row.pagesDone,
    heartbeatAt: row.heartbeatAt?.toISOString() ?? null,
    restarts: row.restarts,
    failure: row.failure,
  };
}

/** Pure: a row as its job reads it, or null for one with no upload. */
function jobOf(row: ReviewerPdfRow): ReviewerPdfJob | null {
  const upload = uploadOf(row);
  return upload ? { id: row.id, status: row.status, upload } : null;
}

/** Every Reviewer PDF (or the one with `id`), with where it's placed. */
async function readPdfs(db: Database | Transaction, id?: string): Promise<AdminReviewerPdf[]> {
  const { reviewerPdfs, topics } = schema;
  const rows = await db
    .select({ pdf: reviewerPdfs, topic: topics })
    .from(reviewerPdfs)
    .leftJoin(topics, eq(topics.id, reviewerPdfs.topicId))
    .where(id === undefined ? undefined : eq(reviewerPdfs.id, id));
  return rows.map(({ pdf, topic }) => ({
    id: pdf.id,
    status: pdf.status,
    upload: uploadOf(pdf),
    placement: placementOf(topic),
  }));
}

/** Runs a database call, naming an unreachable database for what it is. */
async function onDatabase<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw asDatabaseError(error);
  }
}

const { reviewerPdfs } = schema;

/** Whether a Processing row's heartbeat has gone stale by `now` (isStale), or it never beat. */
const staleBy = (now: Date) =>
  or(
    isNull(reviewerPdfs.heartbeatAt),
    lte(reviewerPdfs.heartbeatAt, new Date(now.getTime() - STALE_AFTER_MS)),
  );

/** Updates one Processing row with an upload, where `when` holds too. Whether it did. */
async function changeJob(
  id: string,
  set: Partial<typeof reviewerPdfs.$inferInsert>,
  when?: ReturnType<typeof and>,
): Promise<boolean> {
  return onDatabase(async () => {
    const changed = await getDb()
      .update(reviewerPdfs)
      .set(set)
      .where(
        and(
          eq(reviewerPdfs.id, id),
          eq(reviewerPdfs.status, "processing"),
          isNotNull(reviewerPdfs.uploadedAt),
          when,
        ),
      )
      .returning({ id: reviewerPdfs.id });
    return changed.length === 1;
  });
}

const jobs: ReviewerPdfJobs = {
  get: (id) =>
    onDatabase(async () => {
      const [row] = await getDb().select().from(reviewerPdfs).where(eq(reviewerPdfs.id, id));
      return row ? jobOf(row) : null;
    }),
  beat: (id, pagesDone, now) =>
    changeJob(id, { heartbeatAt: now }, eq(reviewerPdfs.pagesDone, pagesDone)),
  setPageCount: (id, pageCount, now) =>
    changeJob(id, { pageCount, heartbeatAt: now }, isNull(reviewerPdfs.pageCount)),
  advance: (id, from, status, now) =>
    changeJob(
      id,
      { pagesDone: from + 1, status, heartbeatAt: now, restarts: 0 },
      eq(reviewerPdfs.pagesDone, from),
    ),
  fail: (id, failure, now) => changeJob(id, { status: "failed", failure, heartbeatAt: now }),
  stale: (now) =>
    onDatabase(async () => {
      const rows = await getDb()
        .select()
        .from(reviewerPdfs)
        .where(
          and(
            eq(reviewerPdfs.status, "processing"),
            isNotNull(reviewerPdfs.uploadedAt),
            staleBy(now),
          ),
        );
      return rows.flatMap((row) => jobOf(row) ?? []);
    }),
  restart: (id, restarts, now) =>
    changeJob(
      id,
      { restarts: restarts + 1, heartbeatAt: now },
      and(eq(reviewerPdfs.restarts, restarts), staleBy(now)),
    ),
};

const calls = reviewerPdfCalls({
  files: isStorageConfigured ? storageArm.reviewerPdfFiles : sampleReviewerPdfFiles,
  jobs,
  list: () => onDatabase(() => readPdfs(getDb())),
  add: (id, upload, activity) =>
    onDatabase(() =>
      getDb().transaction(async (tx) => {
        await tx.execute(adminWriteLock("content"));
        const inserted = await tx
          .insert(reviewerPdfs)
          .values({
            id,
            topicId: null,
            status: "processing",
            freePreview: false,
            fileName: upload.fileName,
            fileSize: upload.fileSize,
            uploadedAt: new Date(upload.uploadedAt),
            pageCount: upload.pageCount,
            pagesDone: upload.pagesDone,
            heartbeatAt: upload.heartbeatAt === null ? null : new Date(upload.heartbeatAt),
            restarts: upload.restarts,
            failure: upload.failure,
          })
          .onConflictDoNothing({ target: reviewerPdfs.id })
          .returning({ id: reviewerPdfs.id });
        if (inserted.length === 0) return false;
        await tx.insert(schema.staffActivity).values(staffActivityToRow(activity));
        return true;
      }),
    ),
  remove: (id, activityOf) =>
    onDatabase(() =>
      getDb().transaction(async (tx) => {
        await tx.execute(adminWriteLock("content"));
        const [pdf] = await readPdfs(tx, id);
        if (!pdf) return null;
        await tx.delete(reviewerPdfs).where(eq(reviewerPdfs.id, id));
        await tx.insert(schema.staffActivity).values(staffActivityToRow(activityOf(pdf)));
        return pdf;
      }),
    ),
});

export const {
  listReviewerPdfsForAdmin,
  recordReviewerPdf,
  deleteReviewerPdf,
  runReviewerPdfJob,
  restartStaleReviewerPdfJobs,
} = calls;
