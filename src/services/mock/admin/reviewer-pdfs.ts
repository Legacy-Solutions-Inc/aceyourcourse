import { isStale } from "@/lib/reviewer-pdfs/job";
import type { AdminReviewerPdf } from "@/services/admin.types";
import type { ReviewerPdf, ReviewerPdfUpload } from "@/services/content.types";
import { getSampleStore, type SampleStore } from "@/services/mock/sample-store";
import {
  placementOf,
  type ReviewerPdfJob,
  type ReviewerPdfJobs,
  reviewerPdfCalls,
  type ReviewerPdfRecord,
  reviewerPdfRecordOf,
  type ReviewerPdfStore,
} from "@/services/reviewer-pdfs.core";
import { sampleReviewerPdfFiles } from "@/services/uploads.mock";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Reviewer PDFs on the sample data (Phase 3, ticket 12): the
// shared calls (src/services/reviewer-pdfs.core.ts) over the sample store.
// A Reviewer PDF's record is in `reviewerPdfs`, as ticket 05 made it, and its
// upload and job in `reviewerPdfUploads`, by its id; the files are in the
// sample data's private Reviewer PDFs bucket. Each write sets Staff Activity
// first, so a write that fails there (a test's breakStaffActivity) changes
// nothing. A placement's stamp (ticket 13) is in the store's stamps.
// ─────────────────────────────────────────────────────────────────────────────

/** Pure: a Reviewer PDF as the Admin lists it, with its upload and where it's placed. */
function adminPdfOf(store: SampleStore, pdf: ReviewerPdf): AdminReviewerPdf {
  const topic = pdf.topicId ? store.topics.find((candidate) => candidate.id === pdf.topicId) : null;
  return {
    id: pdf.id,
    status: pdf.status,
    upload: Object.hasOwn(store.reviewerPdfUploads, pdf.id)
      ? structuredClone(store.reviewerPdfUploads[pdf.id] ?? null)
      : null,
    placement: placementOf(topic),
  };
}

/** Pure: one Reviewer PDF, with every Topic and its stamp, or null when it isn't there. */
function recordOf(store: SampleStore, id: string): ReviewerPdfRecord | null {
  const pdf = store.reviewerPdfs.find((candidate) => candidate.id === id);
  if (!pdf) return null;
  const onTopic = new Map(store.reviewerPdfs.map((each) => [each.topicId, each.id]));
  return structuredClone({
    pdf,
    upload: Object.hasOwn(store.reviewerPdfUploads, id)
      ? (store.reviewerPdfUploads[id] ?? null)
      : null,
    topics: store.topics.map((topic) => ({
      ...topic,
      reviewerPdfId: onTopic.get(topic.id) ?? null,
    })),
    stamp: store.stamps[reviewerPdfRecordOf(id)] ?? null,
    seededAt: store.bootedAt,
  });
}

/** A Reviewer PDF's job, or null when there's none with that id, or it has no upload. */
function jobOf(store: SampleStore, id: string): ReviewerPdfJob | null {
  const pdf = store.reviewerPdfs.find((candidate) => candidate.id === id);
  const upload = Object.hasOwn(store.reviewerPdfUploads, id)
    ? store.reviewerPdfUploads[id]
    : undefined;
  return pdf && upload ? { id, status: pdf.status, upload: structuredClone(upload) } : null;
}

/**
 * Changes a Processing job, if `when` holds of it: its upload, and its status
 * when given. Whether it did.
 */
function change(
  id: string,
  when: (job: ReviewerPdfJob) => boolean,
  to: (upload: ReviewerPdfUpload) => Partial<ReviewerPdfUpload>,
  status?: ReviewerPdf["status"],
): boolean {
  const store = getSampleStore();
  const job = jobOf(store, id);
  if (!job || job.status !== "processing" || !when(job)) return false;
  store.reviewerPdfUploads = {
    ...store.reviewerPdfUploads,
    [id]: { ...job.upload, ...to(job.upload) },
  };
  if (status) {
    store.reviewerPdfs = store.reviewerPdfs.map((pdf) =>
      pdf.id === id ? { ...pdf, status } : pdf,
    );
  }
  return true;
}

const jobs: ReviewerPdfJobs = {
  async get(id) {
    return jobOf(getSampleStore(), id);
  },
  async beat(id, pagesDone, now) {
    return change(
      id,
      (job) => job.upload.pagesDone === pagesDone,
      () => ({ heartbeatAt: now.toISOString() }),
    );
  },
  async setPageCount(id, pageCount, now) {
    return change(
      id,
      (job) => job.upload.pageCount === null,
      () => ({ pageCount, heartbeatAt: now.toISOString() }),
    );
  },
  async advance(id, from, status, now) {
    return change(
      id,
      (job) => job.upload.pagesDone === from,
      () => ({ pagesDone: from + 1, heartbeatAt: now.toISOString(), restarts: 0 }),
      status,
    );
  },
  async fail(id, failure, now) {
    return change(
      id,
      () => true,
      () => ({ failure, heartbeatAt: now.toISOString() }),
      "failed",
    );
  },
  async stale(now) {
    const store = getSampleStore();
    return Object.keys(store.reviewerPdfUploads)
      .map((id) => jobOf(store, id))
      .filter((job): job is ReviewerPdfJob => job !== null)
      .filter((job) => isStale({ status: job.status, heartbeatAt: job.upload.heartbeatAt }, now));
  },
  async restart(id, restarts, now) {
    return change(
      id,
      (job) =>
        job.upload.restarts === restarts &&
        isStale({ status: job.status, heartbeatAt: job.upload.heartbeatAt }, now),
      () => ({ restarts: restarts + 1, heartbeatAt: now.toISOString() }),
    );
  },
};

/** The sample data's Reviewer PDF store, for the shared calls (and a test's own files). */
export const sampleReviewerPdfStore: ReviewerPdfStore = {
  files: sampleReviewerPdfFiles,
  jobs,
  async list() {
    const store = getSampleStore();
    return store.reviewerPdfs.map((pdf) => adminPdfOf(store, pdf));
  },
  async read(id) {
    return recordOf(getSampleStore(), id);
  },
  async save(id, plan) {
    const store = getSampleStore();
    const planned = plan(recordOf(store, id));
    if (!planned.ok || !planned.writes) return planned;
    const { pdf, stamp, activity } = planned.writes;
    store.staffActivity = [...store.staffActivity, activity];
    store.reviewerPdfs = store.reviewerPdfs.map((each) =>
      each.id === id ? structuredClone(pdf) : each,
    );
    if (stamp) store.stamps = { ...store.stamps, [reviewerPdfRecordOf(id)]: stamp };
    return planned;
  },
  async add(id, upload, activity) {
    const store = getSampleStore();
    if (store.reviewerPdfs.some((pdf) => pdf.id === id)) return false;
    store.staffActivity = [...store.staffActivity, activity];
    store.reviewerPdfs = [
      ...store.reviewerPdfs,
      { id, topicId: null, status: "processing", freePreview: false },
    ];
    store.reviewerPdfUploads = { ...store.reviewerPdfUploads, [id]: structuredClone(upload) };
    return true;
  },
  async remove(id, activityOf) {
    const store = getSampleStore();
    const pdf = store.reviewerPdfs.find((candidate) => candidate.id === id);
    if (!pdf) return null;
    const deleted = adminPdfOf(store, pdf);
    store.staffActivity = [...store.staffActivity, activityOf(deleted)];
    store.reviewerPdfs = store.reviewerPdfs.filter((candidate) => candidate.id !== id);
    const { [id]: _removed, ...uploads } = store.reviewerPdfUploads;
    store.reviewerPdfUploads = uploads;
    const { [reviewerPdfRecordOf(id)]: _stamp, ...stamps } = store.stamps;
    store.stamps = stamps;
    return deleted;
  },
};

const calls = reviewerPdfCalls(sampleReviewerPdfStore);

export const listReviewerPdfsForAdmin = calls.listReviewerPdfsForAdmin;
export const recordReviewerPdf = calls.recordReviewerPdf;
export const deleteReviewerPdf = calls.deleteReviewerPdf;
export const runReviewerPdfJob = calls.runReviewerPdfJob;
export const restartStaleReviewerPdfJobs = calls.restartStaleReviewerPdfJobs;
export const getReviewerPdfForAdmin = calls.getReviewerPdfForAdmin;
export const getReviewerPdfPageForAdmin = calls.getReviewerPdfPageForAdmin;
export const placeReviewerPdf = calls.placeReviewerPdf;
export const setReviewerPdfPublished = calls.setReviewerPdfPublished;
export const setReviewerPdfFreePreview = calls.setReviewerPdfFreePreview;
