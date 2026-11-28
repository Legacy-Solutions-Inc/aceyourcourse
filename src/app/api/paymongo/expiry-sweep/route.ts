import { expireOverdueOrders } from "@/services/member";
import { paymentsClient } from "@/services/payments";

import { cronRefusal } from "../../cron-access";

// GET /api/paymongo/expiry-sweep (Phase 4, ticket 05; spec, Phase 4 planning
// decisions → Recording an outcome): Vercel Cron calls it once a day
// (vercel.json, at the Reviewer PDF job's time; no per-minute job) with
// CRON_SECRET as a bearer token. For each Pending Order older than 24 hours
// it asks PayMongo once more, records Paid if it says so (a late payment
// still counts), otherwise Expired. Every screen already shows such an Order
// Expired before this runs. It says how many, no more.

export async function GET(request: Request): Promise<Response> {
  const refusal = cronRefusal(request);
  if (refusal) return refusal;
  return Response.json(await expireOverdueOrders(paymentsClient()));
}
