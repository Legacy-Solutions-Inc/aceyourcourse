import { requireStaff } from "@/lib/admin/guard";
import { pageFromAddress } from "@/lib/reviewer-pdfs/reader";
import { paths } from "@/paths";
import { getReviewerPdfPageForAdmin } from "@/services/admin";

// GET /admin/content/reviewer-pdfs/<id>/pages/<page> (Phase 3, ticket 13):
// one of a Reviewer PDF's clean page images, for its preview in the Admin,
// Draft or not. Staff only, like every Admin route: the Staff Guard sends
// anyone else to sign-in or the 403 screen, and a closed Admin answers 404.
// The bucket has no public URLs, and the page is never cached anywhere, not
// even in the Staff User's browser, so no copy outlives their session. A
// Member only ever gets a page stamped with their own details, through the
// Member App's protected page endpoint (ticket 14).

const PRIVATE = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; page: string }> },
): Promise<Response> {
  const { id, page } = await params;
  const number = pageFromAddress(page);
  const actor = await requireStaff(paths.admin.reviewerPdf(id));
  const image = number === null ? null : await getReviewerPdfPageForAdmin(actor, id, number);
  if (!image) return new Response("Not found", { status: 404, headers: PRIVATE });
  return new Response(image, {
    headers: {
      ...PRIVATE,
      "content-type": "image/webp",
      "content-length": String(image.byteLength),
    },
  });
}
