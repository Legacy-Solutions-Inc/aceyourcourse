import { z } from "zod";

import {
  MAX_PDF_BYTES,
  nextBatch,
  type ReviewerPdfFailure,
  restartOrFail,
  statusAfter,
} from "@/lib/reviewer-pdfs/job";
import {
  changeRefusal,
  type ReviewerPdfChange,
  reviewerPdfState,
  statusAfterChange,
  TOPIC_GONE,
  TOPIC_TAKEN,
} from "@/lib/reviewer-pdfs/status";
import {
  type ReviewerPdfPlacementForm,
  type ReviewerPdfRecordInput,
  reviewerPdfFreePreviewInputSchema,
  reviewerPdfIdInputSchema,
  reviewerPdfPlacementSchema,
  reviewerPdfPublishedInputSchema,
  reviewerPdfRecordSchema,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminResult,
  AdminReviewerPdf,
  AdminReviewerPdfDetail,
  AdminReviewerPdfScreen,
  PlacementTopic,
  RecordStamp,
  ReviewerPdfRun,
  StaffActivity,
  StaffActor,
  StaleReviewerPdfJobs,
} from "@/services/admin.types";
import type {
  ReviewerPdf,
  ReviewerPdfStatus,
  ReviewerPdfUpload,
  Topic,
} from "@/services/content.types";
import {
  activityRecord,
  formError,
  NOT_FOUND,
  refused,
  staffInput,
} from "@/services/content-editor.core";
import { nextStamp } from "@/services/mock/sample-store";
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
// Ticket 13 adds its screen: an Editor places it under a Topic, one Reviewer
// PDF per Topic (the placement form's save, with the conflict check against
// the placement's stamp), publishes or unpublishes it (src/lib/reviewer-pdfs/
// status.ts), flags it Free Preview, and previews its pages. Each write runs
// under the content write lock (store.save), where the rules run again on
// the Reviewer PDF as it is then, and records one Staff Activity record.
// Publish, Unpublish and Free Preview are single actions: they always save,
// and leave the placement's stamp as it is.
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

/**
 * One Reviewer PDF as its screen and its writes read it (ticket 13): its
 * record, its upload, every Topic it could be placed under (with the
 * Reviewer PDF on each), and its placement's last save.
 */
export interface ReviewerPdfRecord {
  pdf: ReviewerPdf;
  upload: ReviewerPdfUpload | null;
  /** Every Topic, each with the Reviewer PDF on it, in no particular order. */
  topics: PlacementTopic[];
  /** Its placement's last save, or null when nobody has placed it. */
  stamp: RecordStamp | null;
  /** When the data was made: the stamp of a placement nobody has saved. */
  seededAt: string;
}

/** What a write changes, worked out on the Reviewer PDF as it is under the lock. */
export interface ReviewerPdfWrites {
  /** The record as it now is: its Topic, status and Free Preview. */
  pdf: ReviewerPdf;
  /** The placement's new stamp, when the write placed it. */
  stamp?: RecordStamp;
  activity: StaffActivity;
}

/** A write's answer: refused, or its value and what it changes (null: nothing). */
export type ReviewerPdfPlan<T> =
  { ok: false; error: AdminError } | { ok: true; value: T; writes: ReviewerPdfWrites | null };

export interface ReviewerPdfStore {
  /** The private Reviewer PDFs bucket. */
  files: ReviewerPdfFiles;
  jobs: ReviewerPdfJobs;
  /** One Reviewer PDF, with every Topic and its stamp, or null when it isn't there. */
  read(id: string): Promise<ReviewerPdfRecord | null>;
  /**
   * Holds off every other content write, reads the Reviewer PDF again, and
   * saves the writes `plan` works out on it (its record, its stamp, its
   * Staff Activity): all, or nothing. Gives plan's answer. Throws when the
   * save fails.
   */
  save<T>(
    id: string,
    plan: (current: ReviewerPdfRecord | null) => ReviewerPdfPlan<T>,
  ): Promise<ReviewerPdfPlan<T>>;
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

/** A Reviewer PDF's placement in the save stamps. */
export const reviewerPdfRecordOf = (id: string) => `reviewer-pdf:${id}`;

/** Pure: its placement's stamp: its last save, or the data's, when nobody has placed it. */
const stampOf = ({ stamp, seededAt }: ReviewerPdfRecord): RecordStamp =>
  stamp ?? { savedAt: seededAt, savedBy: null };

/** Pure: the Topic with this id, among a Reviewer PDF's record's. */
const topicIn = ({ topics }: ReviewerPdfRecord, id: string | null) =>
  topics.find((candidate) => candidate.id === id);

/** Pure: a Reviewer PDF as its screen shows it. */
export function adminPdfDetailOf(record: ReviewerPdfRecord): AdminReviewerPdfDetail {
  const { pdf, upload } = record;
  return {
    id: pdf.id,
    status: pdf.status,
    upload: structuredClone(upload),
    placement: placementOf(topicIn(record, pdf.topicId)),
    topicId: pdf.topicId,
    freePreview: pdf.freePreview,
    stamp: stampOf(record),
  };
}

/** Pure: Topics by Exam, then Subject, then place. */
const byPlace = (a: PlacementTopic, b: PlacementTopic) =>
  a.examCode.localeCompare(b.examCode) ||
  a.subjectCode.localeCompare(b.subjectCode) ||
  a.position - b.position ||
  a.id.localeCompare(b.id);

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

  /** A write under the lock, answering with what its plan gave. */
  async function saved<T>(
    id: string,
    plan: (current: ReviewerPdfRecord | null) => ReviewerPdfPlan<T>,
  ): Promise<AdminResult<T>> {
    const planned = await store.save(id, plan);
    return planned.ok ? { ok: true, value: planned.value, tags: [] } : planned;
  }

  /**
   * A single action on a Reviewer PDF (Publish, Unpublish, Free Preview): it
   * always saves, with no conflict check, and records the field it changed.
   * Changing nothing saves and records nothing.
   */
  function singleChange(
    actor: StaffActor,
    id: string,
    change: (
      current: ReviewerPdfRecord,
    ) => { error: string } | { pdf: ReviewerPdf; action: string; field: "status" | "freePreview" },
  ): Promise<AdminResult<AdminReviewerPdfDetail>> {
    const now = new Date();
    return saved(id, (current): ReviewerPdfPlan<AdminReviewerPdfDetail> => {
      if (!current) return NOT_FOUND;
      const changed = change(current);
      if ("error" in changed) return refused(formError(changed.error));
      const { pdf, action, field } = changed;
      const value = adminPdfDetailOf({ ...current, pdf });
      if (pdf[field] === current.pdf[field]) return { ok: true, value, writes: null };
      return {
        ok: true,
        value,
        writes: {
          pdf,
          activity: activityRecord(
            actor,
            now,
            "reviewer-pdf",
            id,
            action,
            { [field]: current.pdf[field] },
            { [field]: pdf[field] },
          ),
        },
      };
    });
  }

  async function getReviewerPdfForAdmin(
    _actor: StaffActor,
    id: string,
  ): Promise<AdminReviewerPdfScreen | null> {
    if (!isId(id)) return null;
    const record = await store.read(id);
    if (!record) return null;
    return { pdf: adminPdfDetailOf(record), topics: [...record.topics].sort(byPlace) };
  }

  async function getReviewerPdfPageForAdmin(
    _actor: StaffActor,
    id: string,
    page: number,
  ): Promise<Uint8Array | null> {
    if (!isId(id) || !Number.isSafeInteger(page) || page < 1) return null;
    const job = await jobs.get(id);
    // Only the pages its job has stored: all of a Draft's, a Processing one's so far.
    if (!job || page > job.upload.pagesDone) return null;
    return files.readPage(id, page);
  }

  async function placeReviewerPdf(
    actor: StaffActor,
    input: ReviewerPdfPlacementForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminReviewerPdfDetail>> {
    const form = staffInput(actor, reviewerPdfPlacementSchema, input);
    if (!form.ok) return form;
    const { id, topic: topicId } = form.value;
    const now = new Date();
    const topicError = (message: string) =>
      refused({ kind: "invalid", fieldErrors: { topic: [message] } });

    return saved(id, (current): ReviewerPdfPlan<AdminReviewerPdfDetail> => {
      if (!current) return NOT_FOUND;
      const { pdf, upload } = current;
      const stamp = stampOf(current);
      if (expected && expected.savedAt !== stamp.savedAt) {
        return refused({ kind: "conflict", ...stamp });
      }
      // Already there: nothing to save or record, and the form's stamp stays good.
      if (pdf.topicId === topicId) {
        return { ok: true, value: adminPdfDetailOf(current), writes: null };
      }
      const refusal = changeRefusal(reviewerPdfState(pdf, upload), "place");
      if (refusal) return refused(formError(refusal));
      const topic = topicIn(current, topicId);
      if (!topic) return topicError(TOPIC_GONE);
      if (topic.reviewerPdfId !== null && topic.reviewerPdfId !== id) {
        return topicError(TOPIC_TAKEN);
      }
      const placed: ReviewerPdf = { ...pdf, topicId };
      const next = nextStamp(stamp, actor.name, now);
      const before = topicIn(current, pdf.topicId);
      return {
        ok: true,
        value: adminPdfDetailOf({ ...current, pdf: placed, stamp: next }),
        writes: {
          pdf: placed,
          stamp: next,
          activity: activityRecord(
            actor,
            now,
            "reviewer-pdf",
            id,
            "place",
            { placement: placementOf(before) },
            { placement: placementOf(topic) },
          ),
        },
      };
    });
  }

  async function setReviewerPdfPublished(
    actor: StaffActor,
    id: string,
    published: boolean,
  ): Promise<AdminResult<AdminReviewerPdfDetail>> {
    const form = staffInput(actor, reviewerPdfPublishedInputSchema, { id, published });
    if (!form.ok) return form;
    const change: ReviewerPdfChange = form.value.published ? "publish" : "unpublish";
    const status = statusAfterChange(change);
    return singleChange(actor, form.value.id, ({ pdf, upload }) => {
      // Pressed twice, or by two Editors, it's as they asked already: no change, never refused.
      const refusal = changeRefusal(reviewerPdfState(pdf, upload), change);
      if (refusal) return { error: refusal };
      return { pdf: { ...pdf, status }, action: change, field: "status" };
    });
  }

  async function setReviewerPdfFreePreview(
    actor: StaffActor,
    id: string,
    freePreview: boolean,
  ): Promise<AdminResult<AdminReviewerPdfDetail>> {
    const form = staffInput(actor, reviewerPdfFreePreviewInputSchema, { id, freePreview });
    if (!form.ok) return form;
    return singleChange(actor, form.value.id, ({ pdf }) => ({
      pdf: { ...pdf, freePreview: form.value.freePreview },
      action: "free-preview",
      field: "freePreview",
    }));
  }

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
    getReviewerPdfForAdmin,
    getReviewerPdfPageForAdmin,
    placeReviewerPdf,
    setReviewerPdfPublished,
    setReviewerPdfFreePreview,
  };
}
