import { env } from "@/env";
import { serverEnv } from "@/env.server";
import { getStaff } from "@/lib/admin/guard";
import { adminMode } from "@/lib/admin/mode";
import { restoreSampleData } from "@/lib/admin/sample-data";
import { isLocalDatabase } from "@/lib/db/local-database";

/**
 * Live mode only exists for a database that's on this machine outside
 * production: CI's live-mode e2e, on the runner's local Supabase.
 */
const liveOnLocalDatabase =
  adminMode === "live" &&
  env.NODE_ENV !== "production" &&
  isLocalDatabase(serverEnv.DATABASE_URL ?? "") === true;

/**
 * POST /api/dev/sample-data/reset (CONVENTIONS §2): starts the sample data
 * again from the seed and clears every Catalogue cache tag; on the database,
 * it re-seeds a local database and refuses any other (403). In sample mode the
 * Admin specs call it before each test, signed out, so it asks for no
 * sign-in. In live mode (ticket 16) it works only on a local database outside
 * production, for a signed-in Staff User. Anywhere else it answers 404, as if
 * it didn't exist.
 */
export async function POST(request: Request): Promise<Response> {
  if (adminMode !== "sample" && !liveOnLocalDatabase) {
    return new Response("Not Found", { status: 404 });
  }
  // A browser sends the page's origin with a POST. A page on another site
  // (or another local server) mustn't wipe the sample data from a Staff
  // User's browser; a test's request sends no origin at all.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }
  if (adminMode === "live" && !(await getStaff())) {
    return new Response("Sign in as a Staff User to reset the sample data.", { status: 401 });
  }
  const restored = await restoreSampleData();
  if (!restored.ok) {
    return new Response("The sample data can only be reset on a local database.", {
      status: 403,
    });
  }
  return new Response(null, { status: 204 });
}
