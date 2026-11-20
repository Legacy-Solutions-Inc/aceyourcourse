import { after } from "next/server";

import { restartStaleReviewerPdfJobs } from "@/services/admin";
import { startReviewerPdfRun } from "@/services/reviewer-pdf-runs";

import { jobAccessRefusal } from "../job-access";

// GET /api/reviewer-pdfs/cron (Phase 3, ticket 12; ADR 0012): Vercel Cron
// calls it once a day (vercel.json; the Hobby plan allows no more) with
// CRON_SECRET as a bearer token. It restarts each Processing Reviewer PDF job
// whose heartbeat has gone stale, failing one restarted too often, and starts
// a run for each it restarted, after the response. It says how many it
// restarted and failed, no more.

export async function GET(request: Request): Promise<Response> {
  const refusal = jobAccessRefusal(request);
  if (refusal) return refusal;

  const { restarted, failed } = await restartStaleReviewerPdfJobs();
  after(async () => {
    await Promise.all(restarted.map((id) => startReviewerPdfRun(id)));
  });
  return Response.json({ restarted: restarted.length, failed: failed.length });
}
