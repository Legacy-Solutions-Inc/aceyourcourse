import { adminMode } from "@/lib/admin/mode";
import { restoreSampleData } from "@/lib/admin/sample-data";

/**
 * POST /api/dev/sample-data/reset (CONVENTIONS §2): starts the sample data
 * again from the seed and clears every Catalogue cache tag; on the database,
 * it re-seeds a local database and refuses any other (403). The Admin specs
 * call it before each test, signed out, so it asks for no sign-in. In
 * development only; otherwise it answers 404, as if it didn't exist.
 */
export async function POST(request: Request): Promise<Response> {
  if (adminMode !== "sample") return new Response("Not Found", { status: 404 });
  // A browser sends the page's origin with a POST. A page on another site
  // (or another local server) mustn't wipe the sample data from a Staff
  // User's browser; a test's request sends no origin at all.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }
  const restored = await restoreSampleData();
  if (!restored.ok) {
    return new Response("The sample data can only be reset on a local database.", {
      status: 403,
    });
  }
  return new Response(null, { status: 204 });
}
