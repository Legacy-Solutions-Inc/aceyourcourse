import { after } from "next/server";
import { z } from "zod";

import { runReviewerPdfJob } from "@/services/admin";
import { pageRenderer, startReviewerPdfRun } from "@/services/reviewer-pdf-runs";

import { jobAccessRefusal } from "../job-access";

// POST /api/reviewer-pdfs/run {id} (Phase 3, ticket 12; ADR 0012): one run of
// a Reviewer PDF's job, for the server itself (each run starts the next, and
// the cron starts restarted ones) with CRON_SECRET as a bearer token. It
// answers 202 at once and runs after the response, so the run that called it
// is free to end; the run renders the job's next pages, at most 25, and
// starts the next run while pages are left. A run that fails leaves the job
// Processing: its heartbeat goes stale, and the cron restarts it.

/** A run's time limit, in seconds: 25 pages take well under a minute. */
export const maxDuration = 300;

const runRequest = z.object({ id: z.string().uuid() });

export async function POST(request: Request): Promise<Response> {
  const refusal = jobAccessRefusal(request);
  if (refusal) return refusal;
  const body = runRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) return new Response(null, { status: 400 });

  const { id } = body.data;
  after(async () => {
    try {
      if ((await runReviewerPdfJob(id, pageRenderer)) === "more") await startReviewerPdfRun(id);
    } catch (error) {
      console.error("A Reviewer PDF job's run failed; the cron restarts it:", id, error);
    }
  });
  return new Response(null, { status: 202 });
}
