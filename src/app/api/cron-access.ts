import { serverEnv } from "@/env.server";
import { cronAccess } from "@/lib/reviewer-pdfs/cron-auth";

/**
 * The answer for a caller who may not use a scheduled job's endpoint (the
 * Reviewer PDF job, ticket 12; the Order expiry sweep, ticket 05), or null
 * for one who may: 404 while the server has no CRON_SECRET (the endpoints
 * don't run), 401 without it as a bearer token.
 */
export function cronRefusal(request: Request): Response | null {
  switch (cronAccess(request.headers.get("authorization"), serverEnv.CRON_SECRET)) {
    case "allowed":
      return null;
    case "no-secret":
      return new Response(null, { status: 404 });
    case "refused":
      return new Response(null, { status: 401 });
  }
}
