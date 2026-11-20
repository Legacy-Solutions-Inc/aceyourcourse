import { getStaff } from "@/lib/admin/guard";
import { exportMemberData } from "@/services/admin";

// POST /admin/users/privacy-requests/<id>/data (Phase 3, ticket 19; story
// 133q): "Download this Member's data", from a data-copy request. Owners only:
// the seam refuses anyone else, and a closed Admin answers 404. The answer is
// the Member's JSON file as an attachment, never cached anywhere, and the
// download is logged in Staff Activity, so it's a POST: no link preview or
// prefetch makes one, and the session cookies (SameSite=Lax) never come with
// another site's form. The Owner emails the file from the support inbox; the
// app sends nothing.

const PRIVATE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

/** A plain-text answer the browser shows in place of a file. */
const plain = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { ...PRIVATE, "content-type": "text/plain; charset=utf-8" },
  });

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const actor = await getStaff();
  if (!actor) return plain(403, "Sign in to the Admin as an Owner to download a Member’s data.");

  const exported = await exportMemberData(actor, id);
  if (!exported.ok) {
    switch (exported.error.kind) {
      case "forbidden":
        return plain(403, "Only an Owner can download a Member’s data.");
      case "not-found":
        return plain(404, "There’s no such Privacy Request.");
      default:
        return plain(
          409,
          exported.error.kind === "invalid" && exported.error.formError
            ? exported.error.formError
            : "The file couldn’t be made. Go back to the request and try again.",
        );
    }
  }

  const { filename, data } = exported.value;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      ...PRIVATE,
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
