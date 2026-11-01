import { adminMode } from "@/lib/admin/mode";
import { restoreSampleData } from "@/lib/admin/sample-data";

/**
 * POST /api/dev/sample-data/reset (CONVENTIONS §2): starts the sample data
 * again from the seed and clears every Catalogue cache tag. The Admin specs
 * call it before each test, signed out, so it asks for no sign-in. With sample
 * data only; otherwise it answers 404, as if it didn't exist.
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
  restoreSampleData();
  return new Response(null, { status: 204 });
}
