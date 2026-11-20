import { adminMode } from "@/lib/admin/mode";
import { readSignedSampleFile } from "@/services/uploads.mock";

// GET /api/dev/card-images/[token] (ticket 08): the sample data's stand-in
// for a Storage signed URL to a card image in the private bucket. The Member
// seam hands one out only with a deck the access decision allowed, and it
// stops working about 10 minutes later. With sample data only; otherwise it
// answers 404, as if the route didn't exist.

interface RouteContext {
  params: Promise<{ token: string }>;
}

/** Serves the card image while its signed URL is good; 404 once it has expired, or for any other token. */
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  const signed = adminMode === "sample" ? readSignedSampleFile((await params).token) : null;
  if (!signed) return new Response("Not Found", { status: 404 });
  const { file, expiresAt } = signed;
  const secondsLeft = Math.max(Math.floor((Date.parse(expiresAt) - Date.now()) / 1000), 0);
  return new Response(file.bytes, {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.bytes.byteLength),
      // Only this Member's browser keeps it, and never past the URL's life.
      "cache-control": `private, max-age=${secondsLeft}`,
      "x-content-type-options": "nosniff",
    },
  });
}
