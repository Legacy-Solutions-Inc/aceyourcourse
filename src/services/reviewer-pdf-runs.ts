import "server-only";

import { isDatabaseConfigured, serverEnv } from "@/env.server";
import { getSiteURL } from "@/lib/get-site-url";
import { type CronAccess, cronAccess } from "@/lib/reviewer-pdfs/cron-auth";
import { paths } from "@/paths";
import { runReviewerPdfJob } from "@/services/admin";
import type { ReviewerPdfRun } from "@/services/admin.types";
import { createFakeRenderer } from "@/services/page-images.fake";
import { pdfjsRenderer } from "@/services/page-images.pdfjs";
import type { PdfRenderer } from "@/services/page-images.types";

// ─────────────────────────────────────────────────────────────────────────────
// How the Reviewer PDF job runs (Phase 3, ticket 12; ADR 0012). Recording an
// upload starts the first run, each run that leaves pages starts the next,
// and the cron starts a run for each job it restarts, every one of them after
// its response (next/server's `after`), so no Editor waits for a page.
//   - Live, with CRON_SECRET (production): each run is its own call to the
//     run endpoint, so each gets a function's full time. The call goes to the
//     site's own configured URL, never one a request names, so the secret is
//     only ever sent to this site.
//   - Otherwise (the sample data, local, the e2e): the runs go on in this
//     server's process, one after another. The sample data is in this
//     process's memory, so another process couldn't run its jobs anyway.
// The renderer is pdf.js on a server with the database, and on the sample
// data the fake, which takes a second over each page, so the Admin shows the
// job's progress as a real one would.
// ─────────────────────────────────────────────────────────────────────────────

/** How long the sample data's fake renderer takes over each page. */
const SAMPLE_MS_PER_PAGE = 1000;

/** The renderer the job uses on this server. */
export const pageRenderer: PdfRenderer = isDatabaseConfigured
  ? pdfjsRenderer
  : createFakeRenderer({ msPerPage: SAMPLE_MS_PER_PAGE });

export interface RunStarterSettings {
  secret?: string;
  /** Whether the Admin runs on the database, where another function can run the job. */
  live: boolean;
  /** The run endpoint, on the site's own URL. */
  runUrl: string;
  send: (url: string, init: RequestInit) => Promise<Response>;
  /** One run of a job. */
  run: (id: string) => Promise<ReviewerPdfRun>;
}

/**
 * Starts a Reviewer PDF job's next run: asks the run endpoint for it (live,
 * with the secret), or runs every batch left here. Never throws: a run that
 * doesn't start or fails leaves the job Processing, for the cron to restart.
 */
export function createRunStarter({ secret, live, runUrl, send, run }: RunStarterSettings) {
  async function requestRun(id: string, token: string): Promise<void> {
    try {
      const answer = await send(runUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!answer.ok) {
        console.error(
          `The Reviewer PDF job's run endpoint answered ${answer.status}; the cron restarts the job:`,
          id,
        );
      }
    } catch (error) {
      console.error(
        "Couldn't reach the Reviewer PDF job's run endpoint; the cron restarts the job:",
        id,
        error,
      );
    }
  }

  async function runHere(id: string): Promise<void> {
    if (live) {
      console.warn(
        "CRON_SECRET isn't set: this Reviewer PDF job runs in this function, and nothing restarts it if it stops:",
        id,
      );
    }
    try {
      while ((await run(id)) === "more");
    } catch (error) {
      console.error("A Reviewer PDF job's run failed; it stays Processing:", id, error);
    }
  }

  return (id: string): Promise<void> => (live && secret ? requestRun(id, secret) : runHere(id));
}

/** Starts a Reviewer PDF job's next run, on this server. Call it after the response. */
export const startReviewerPdfRun = createRunStarter({
  secret: serverEnv.CRON_SECRET,
  live: isDatabaseConfigured,
  runUrl: new URL(paths.jobs.reviewerPdfRun.slice(1), getSiteURL()).toString(),
  send: (url, init) => fetch(url, init),
  run: (id) => runReviewerPdfJob(id, pageRenderer),
});

/**
 * Whether a request may use the Reviewer PDF job's endpoints: it must carry
 * this server's CRON_SECRET as a bearer token, and there are none while the
 * server has no secret.
 */
export function jobEndpointAccess(authorization: string | null): CronAccess {
  return cronAccess(authorization, serverEnv.CRON_SECRET);
}
