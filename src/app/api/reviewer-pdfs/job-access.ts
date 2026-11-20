import { jobEndpointAccess } from "@/services/reviewer-pdf-runs";

/**
 * The answer for a caller who may not use the Reviewer PDF job's endpoints
 * (ticket 12), or null for one who may: 404 while the server has no
 * CRON_SECRET (the endpoints don't run), 401 without it as a bearer token.
 */
export function jobAccessRefusal(request: Request): Response | null {
  switch (jobEndpointAccess(request.headers.get("authorization"))) {
    case "allowed":
      return null;
    case "no-secret":
      return new Response(null, { status: 404 });
    case "refused":
      return new Response(null, { status: 401 });
  }
}
