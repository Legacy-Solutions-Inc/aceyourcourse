import { z } from "zod";

import {
  MAX_PDF_BYTES,
  nextBatch,
  type ReviewerPdfFailure,
  restartOrFail,
  statusAfter,
} from "@/lib/reviewer-pdfs/job";
import {
  type ReviewerPdfRecordInput,
  reviewerPdfIdInputSchema,
  reviewerPdfRecordSchema,
} from "@/services/admin.schema";
import type {
  AdminResult,
  AdminReviewerPdf,
  ReviewerPdfRun,
  StaffActivity,
  StaffActor,
  StaleReviewerPdfJobs,
} from "@/services/admin.types";
import type { ReviewerPdfStatus, ReviewerPdfUpload, Topic } from "@/services/content.types";
import {
  activityRecord,
  formError,
  NOT_FOUND,
  refused,
  staffInput,
} from "@/services/content-editor.core";
import { PdfProblemError, type PdfRenderer } from "@/services/page-images.types";
import type { ReviewerPdfFiles } from "@/services/uploads";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Reviewer PDFs (Phase 3, ticket 12; stories 114, 115; spec,
// Phase 3 planning decisions → The Reviewer PDF job; ADR 0012), shared by
// both arms, each of which gives its own store (mock/admin/reviewer-pdfs.ts,
// admin.reviewer-pdfs.db.ts):
//   - An Editor's browser uploads the PDF straight to the private bucket;
//     recordReviewerPdf claims the upload and records the Reviewer PDF as
//     Processing, with its Staff Activity. The action then starts the job.
//   - Each run of the job (runReviewerPdfJob) renders the next pages, at most
//     PAGES_PER_RUN, through the page-images interface, storing each page and
//     then moving the job's count on by one, beating as it goes. The move is
//     made only from the count the run expects, so two runs can never both do
//     a page, and a run that dies leaves the count at the last page it
//     finished: the next run picks up from there, repeating and skipping none.
//   - The cron (restartStaleReviewerPdfJobs) restarts each job whose heartbeat
//     has gone stale, and fails it after MAX_RESTARTS.
//   - Deleting removes the record and its Staff Activity together, then the
//     original and every page image.
// The job is no Staff User's change: it records no Staff Activity.
// ─────────────────────────────────────────────────────────────────────────────

/** A Reviewer PDF with an upload, as its job reads it. */
export interface ReviewerPdfJob {
  id: string;
  status: ReviewerPdfStatus;
  upload: ReviewerPdfUpload;
}

/**
 * The jobs' records. Every change is made only while the record still says
 * what the call expects (it's Processing, at that count), so a change that
 * lost a race to another run, a delete or the cron says false and does
 * nothing. Each change beats the heartbeat, at `now`.
 */
export interface ReviewerPdfJobs {
  /** A Reviewer PDF's job, or null when it's not there or has no upload. */
  get(id: string): Promise<ReviewerPdfJob | null>;
  /** Beats as a run starts: only while Processing at `pagesDone`, as the run found it. */
  beat(id: string, pagesDone: number, now: Date): Promise<boolean>;
  /** Sets the page count, once read: only while Processing with none yet. */
  setPageCount(id: string, pageCount: number, now: Date): Promise<boolean>;
  /**
   * Counts one more page done, from `from`, with its new status, and starts
   * the restart count again: only while Processing at `from`.
   */
  advance(id: string, from: number, status: "processing" | "draft", now: Date): Promise<boolean>;
  /** Fails it with its reason: only while Processing. */
  fail(id: string, failure: ReviewerPdfFailure, now: Date): Promise<boolean>;
  /** Every Processing job whose heartbeat has gone stale by `now` (isStale), or that never beat. */
  stale(now: Date): Promise<ReviewerPdfJob[]>;
  /** Counts one more restart and beats: only while it's Processing, stale by `now`, and at `restarts`. */
  restart(id: string, restarts: number, now: Date): Promise<boolean>;
}

export interface ReviewerPdfStore {
  /** The private Reviewer PDFs bucket. */
  files: ReviewerPdfFiles;
  jobs: ReviewerPdfJobs;
  /** Every Reviewer PDF, with its upload and where it's placed, in no particular order. */
  list(): Promise<AdminReviewerPdf[]>;
  /**
   * Adds a newly uploaded Reviewer PDF and its Staff Activity: both, or
   * neither. False, adding nothing, when one with this id is there already.
   * Throws when it can't.
   */
  add(id: string, upload: ReviewerPdfUpload, activity: StaffActivity): Promise<boolean>;
  /**
   * Holds off every other content write, then deletes a Reviewer PDF with
   * the Staff Activity `activityOf` makes of it: both, or neither. Gives it
   * as it was, or null when it isn't there. Throws when it can't.
   */
  remove(
    id: string,
    activityOf: (pdf: AdminReviewerPdf) => StaffActivity,
  ): Promise<AdminReviewerPdf | null>;
}

/** Pure: where a Reviewer PDF is placed, from its Topic, or null when it has none. */
export function placementOf(
  topic: Pick<Topic, "examCode" | "subjectCode" | "name"> | null | undefined,
): AdminReviewerPdf["placement"] {
  return topic
    ? { examCode: topic.examCode, subjectCode: topic.subjectCode, topicName: topic.name }
    : null;
}

const UPLOAD_AGAIN = "UPLOAD THE PDF AGAIN";
const NOT_ARRIVED = "THE PDF HASN’T FINISHED UPLOADING · UPLOAD IT AGAIN";

const isId = (id: string) => z.string().uuid().safeParse(id).success;

/** Pure: newest upload first, then the sample data's (no upload), each by id. */
function newestFirst(a: AdminReviewerPdf, b: AdminReviewerPdf): number {
  const at = (pdf: AdminReviewerPdf) => pdf.upload?.uploadedAt ?? "";
  return at(b).localeCompare(at(a)) || a.id.localeCompare(b.id);
}

/** Pure: what Staff Activity keeps of a deleted Reviewer PDF. */
const snapshot = ({ status, upload, placement }: AdminReviewerPdf) => ({
  fileName: upload?.fileName ?? null,
  status,
  pageCount: upload?.pageCount ?? null,
  placement,
});

export function reviewerPdfCalls(store: ReviewerPdfStore) {
  const { files, jobs } = store;

  async function listReviewerPdfsForAdmin(_actor: StaffActor): Promise<AdminReviewerPdf[]> {
    return (await store.list()).sort(newestFirst);
  }

  async function recordReviewerPdf(
    actor: StaffActor,
    input: ReviewerPdfRecordInput,
  ): Promise<AdminResult<AdminReviewerPdf>> {
    const begun = staffInput(actor, reviewerPdfRecordSchema, input);
    if (!begun.ok) return begun;
    const { path, fileName } = begun.value;

    const claimed = await files.claimUpload(path);
    if (claimed === null) return refused(formError(UPLOAD_AGAIN));
    if (claimed === "waiting") return refused(formError(NOT_ARRIVED));

    const now = new Date();
    const upload: ReviewerPdfUpload = {
      fileName,
      fileSize: claimed.size,
      uploadedAt: now.toISOString(),
      pageCount: null,
      pagesDone: 0,
      // It beats from the start, so a job whose first run never starts goes stale.
      heartbeatAt: now.toISOString(),
      restarts: 0,
      failure: null,
    };
    const activity = activityRecord(actor, now, "reviewer-pdf", claimed.id, "upload", null, {
      fileName,
      fileSize: claimed.size,
    });
    let added: boolean;
    try {
      added = await store.add(claimed.id, upload, activity);
    } catch (error) {
      // Nothing records the file now: the Editor uploads it again.
      await files.remove(claimed.id, 0);
      throw error;
    }
    // Recorded already, by the same request sent twice: its file stays.
    if (!added) return refused(formError(UPLOAD_AGAIN));
    return {
      ok: true,
      value: { id: claimed.id, status: "processing", upload, placement: null },
      tags: [],
    };
  }

  async function deleteReviewerPdf(
    actor: StaffActor,
    id: string,
  ): Promise<AdminResult<AdminReviewerPdf>> {
    const begun = staffInput(actor, reviewerPdfIdInputSchema, { id });
    if (!begun.ok) return begun;
    const now = new Date();
    const deleted = await store.remove(id, (pdf) =>
      activityRecord(actor, now, "reviewer-pdf", id, "delete", snapshot(pdf), null),
    );
    if (!deleted) return NOT_FOUND;
    // A page count it doesn't know yet means no page was stored: a run in
    // flight that stores one finds the record gone, and deletes its pages.
    await files.remove(id, deleted.upload?.pageCount ?? 0);
    return { ok: true, value: deleted, tags: [] };
  }

  /** Fails a job with its reason, and says so. */
  async function failed(id: string, failure: ReviewerPdfFailure): Promise<ReviewerPdfRun> {
    return (await jobs.fail(id, failure, new Date())) ? "failed" : "stopped";
  }

  /**
   * After a change the record refused: another run has the pages, or the
   * Reviewer PDF was deleted, in which case this run's pages go too.
   */
  async function lostTheJob(id: string, pageCount: number): Promise<ReviewerPdfRun> {
    if (!(await jobs.get(id))) await files.remove(id, pageCount);
    return "stopped";
  }

  async function runReviewerPdfJob(id: string, renderer: PdfRenderer): Promise<ReviewerPdfRun> {
    if (!isId(id)) return "stopped";
    const job = await jobs.get(id);
    if (!job || job.status !== "processing") return "stopped";
    // It beats as it starts, before reading a PDF of up to 200 MB, so a
    // slow start never looks stale; a job another run has moved on is theirs.
    if (!(await jobs.beat(id, job.upload.pagesDone, new Date()))) return "stopped";
    // Storage holds a PDF to 200 MB; a bigger one fails before it's read.
    if (job.upload.fileSize > MAX_PDF_BYTES) return failed(id, "too-big");
    const bytes = await files.readOriginal(id);
    if (!bytes) return failed(id, "corrupt");
    if (bytes.byteLength > MAX_PDF_BYTES) return failed(id, "too-big");

    const opened = await renderer.open(bytes);
    if (!opened.ok) return failed(id, opened.problem);
    const { pdf } = opened;
    try {
      const { pageCount } = pdf;
      if (job.upload.pageCount === null) {
        if (!(await jobs.setPageCount(id, pageCount, new Date()))) {
          return await lostTheJob(id, pageCount);
        }
      } else if (job.upload.pageCount !== pageCount) {
        // The file isn't the one the job started on.
        return await failed(id, "corrupt");
      }
      const batch = nextBatch({ pageCount, pagesDone: job.upload.pagesDone });
      if (!batch) return "done";
      for (let page = batch.from; page <= batch.to; page++) {
        const image = await pdf.renderPage(page);
        await files.putPage(id, page, image);
        const status = statusAfter({ pageCount, pagesDone: page });
        if (!(await jobs.advance(id, page - 1, status, new Date()))) {
          return await lostTheJob(id, pageCount);
        }
      }
      return batch.to === pageCount ? "done" : "more";
    } catch (error) {
      if (error instanceof PdfProblemError) return await failed(id, error.problem);
      // Anything else is the server's: the job stays Processing, and the
      // cron restarts it once its heartbeat goes stale.
      throw error;
    } finally {
      await pdf.close();
    }
  }

  async function restartStaleReviewerPdfJobs(): Promise<StaleReviewerPdfJobs> {
    const now = new Date();
    const found: StaleReviewerPdfJobs = { restarted: [], failed: [] };
    for (const job of await jobs.stale(now)) {
      if (restartOrFail(job.upload) === "fail") {
        if (await jobs.fail(job.id, "too-many-restarts", now)) found.failed.push(job.id);
      } else if (await jobs.restart(job.id, job.upload.restarts, now)) {
        found.restarted.push(job.id);
      }
    }
    return found;
  }

  return {
    listReviewerPdfsForAdmin,
    recordReviewerPdf,
    deleteReviewerPdf,
    runReviewerPdfJob,
    restartStaleReviewerPdfJobs,
  };
}
