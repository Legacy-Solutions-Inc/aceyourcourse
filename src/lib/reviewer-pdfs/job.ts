import type { ReviewerPdfStatus } from "@/services/content.types";

// The Reviewer PDF job's rules (Phase 3, ticket 12; spec, Phase 3 planning
// decisions → The Reviewer PDF job; ADR 0012), pure. An Editor's upload is
// split into page images by a chain of short runs, each rendering the next
// pages after the last one done, so a run that dies costs only its own pages:
// the next run picks up where the job's record says. A cron restarts a job
// whose runs have stopped (its heartbeat has gone stale), and gives up after
// MAX_RESTARTS, failing it with the fix to try.

/** The largest Reviewer PDF an Editor can upload: 200 MB. */
export const MAX_PDF_BYTES = 200 * 1024 * 1024;

/** How many pages one run renders: a run stays well inside a function's time limit. */
export const PAGES_PER_RUN = 25;

/** How wide each page image is, in pixels: the reader zooms it in the browser. */
export const PAGE_WIDTH = 1600;

/**
 * How long a Processing job can go without a heartbeat before the cron
 * restarts it. A run beats as it starts and after every page, which takes a
 * second or two, so two minutes of silence means the run has died (a crash,
 * a time-out, a deploy), not that it's slow; with the cron every minute, a
 * dead run is restarted within about three minutes.
 */
export const STALE_AFTER_MS = 2 * 60 * 1000;

/**
 * How many times in a row the cron restarts one job, with no page done in
 * between, before failing it: each page done starts the count again. Three
 * covers a deploy or a passing Storage outage, each of which stops a run
 * once; a PDF that stops every run at the same page (one that runs the
 * function out of memory, say) then fails within about ten minutes, rather
 * than being retried forever, while a long PDF's occasional stops never add up.
 */
export const MAX_RESTARTS = 3;

/** Why a Reviewer PDF failed. */
export const REVIEWER_PDF_FAILURES = [
  "password",
  "corrupt",
  "too-big",
  "too-many-restarts",
] as const;
export type ReviewerPdfFailure = (typeof REVIEWER_PDF_FAILURES)[number];

const FAILURES: Record<ReviewerPdfFailure, { reason: string; fix: string }> = {
  password: {
    reason: "The PDF is password-protected.",
    fix: "Remove the password and upload again.",
  },
  corrupt: {
    reason: "The PDF is damaged or can’t be read.",
    fix: "Re-export the PDF and upload again.",
  },
  "too-big": {
    reason: "The PDF is over 200 MB.",
    fix: "Save a smaller copy, 200 MB or less, and upload again.",
  },
  "too-many-restarts": {
    reason: `Splitting it into pages stopped ${MAX_RESTARTS} times in a row.`,
    fix: "Try again, or contact the developer.",
  },
};

/** Pure: why it failed, and the fix to try, as the Admin shows them. */
export function failureMessage(failure: ReviewerPdfFailure): { reason: string; fix: string } {
  return FAILURES[failure];
}

/** The job's progress: its page count once the PDF has been read, and how many pages are done. */
export interface JobProgress {
  pageCount: number | null;
  pagesDone: number;
}

/**
 * Pure: the pages the next run renders, from the page after the last one
 * done, at most PAGES_PER_RUN of them, or null when none are left (or the PDF
 * hasn't been read yet).
 */
export function nextBatch({
  pageCount,
  pagesDone,
}: JobProgress): { from: number; to: number } | null {
  if (pageCount === null || pagesDone >= pageCount) return null;
  return { from: pagesDone + 1, to: Math.min(pagesDone + PAGES_PER_RUN, pageCount) };
}

/** Pure: a job's status once `pagesDone` pages are done: a Draft once the last one is. */
export function statusAfter({ pageCount, pagesDone }: JobProgress): "processing" | "draft" {
  return pageCount !== null && pagesDone >= pageCount ? "draft" : "processing";
}

/**
 * Pure: whether a Processing job's runs have stopped: no heartbeat for
 * STALE_AFTER_MS, or none at all. Anything not Processing never is.
 */
export function isStale(
  job: { status: ReviewerPdfStatus; heartbeatAt: string | null },
  now: Date,
): boolean {
  if (job.status !== "processing") return false;
  return job.heartbeatAt === null || now.getTime() - Date.parse(job.heartbeatAt) >= STALE_AFTER_MS;
}

/** Pure: what the cron does with a stale job: restart it, or fail it after MAX_RESTARTS. */
export function restartOrFail({ restarts }: { restarts: number }): "restart" | "fail" {
  return restarts >= MAX_RESTARTS ? "fail" : "restart";
}

const pages = (count: number) => (count === 1 ? "1 page" : `${count} pages`);

/** Pure: a Reviewer PDF's status and progress, as the Admin's list shows it. */
export function progressLabel(job: JobProgress & { status: ReviewerPdfStatus }): string {
  switch (job.status) {
    case "processing":
      return job.pageCount === null
        ? "Processing · reading the PDF"
        : `Processing · ${job.pagesDone} of ${job.pageCount} pages`;
    case "failed":
      return "Failed";
    default: {
      const status =
        job.status === "draft" ? "Draft" : job.status === "published" ? "Published" : "Unpublished";
      return job.pageCount === null ? status : `${status} · ${pages(job.pageCount)}`;
    }
  }
}

/** Pure: how much of a Processing job is done, 0 to 100, or null before the PDF has been read. */
export function percentDone({ pageCount, pagesDone }: JobProgress): number | null {
  return pageCount ? Math.round((pagesDone / pageCount) * 100) : null;
}
