import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getCardImageForAdmin } from "@/services/admin";

// GET /admin/content/deck/image/<card> (Phase 3, ticket 07): a card's back
// image from the private content bucket, for the card editor. Staff only,
// like every Admin route: the Staff Guard sends anyone else to sign-in or the
// 403 screen, and a closed Admin answers 404. The bucket has no public URLs,
// and nothing here is cached anywhere but this Staff User's browser session.
// Members get a card's image only through the Member App's own checks
// (ticket 08).

const PRIVATE = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ card: string }> },
): Promise<Response> {
  const { card } = await params;
  const actor = await requireStaff(paths.admin.cardImage(card));
  const image = await getCardImageForAdmin(actor, card);
  if (!image) return new Response("Not found", { status: 404, headers: PRIVATE });
  return new Response(image.bytes, {
    headers: {
      ...PRIVATE,
      "content-type": image.contentType,
      "content-length": String(image.bytes.byteLength),
    },
  });
}
