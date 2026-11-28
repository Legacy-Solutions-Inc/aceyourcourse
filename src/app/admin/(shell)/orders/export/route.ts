import { getStaff } from "@/lib/admin/guard";
import { parseOrdersParams } from "@/lib/admin/orders-list";
import { exportOrdersCsv } from "@/services/admin";

// GET /admin/orders/export?… (Phase 4, ticket 07; story 147): "Export CSV",
// exactly the Orders the list's filters (the same search params) match, for
// the accountant. Owners only: the seam refuses anyone else, and a closed
// Admin answers 404. The file is an attachment, never cached anywhere, and
// each export is logged in Staff Activity. Only the Orders screen's own
// request (Sec-Fetch-Site same-origin) or an address the Owner typed (none)
// exports: a request another site, or a sibling subdomain, starts is
// refused, so no other page can make an Owner's browser log an export. A
// repeated filter reads its first value, as the list's page does.

const PRIVATE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

/** Where a browser says a request came from that may export: this site's own page, or the Owner. */
const OWN_REQUESTS = new Set(["same-origin", "none"]);

/** Pure: the search params as a page's searchParams has them, a repeated one as all its values. */
function searchParamsOf(url: string): Record<string, string | string[]> {
  const params: Record<string, string[]> = {};
  for (const [key, value] of new URL(url).searchParams) (params[key] ??= []).push(value);
  return params;
}

/** A plain-text answer the browser shows in place of a file. */
const plain = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { ...PRIVATE, "content-type": "text/plain; charset=utf-8" },
  });

export async function GET(request: Request): Promise<Response> {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && !OWN_REQUESTS.has(site)) {
    return plain(403, "Export the CSV from the Orders screen.");
  }
  const actor = await getStaff();
  if (!actor) return plain(403, "Sign in to the Admin as an Owner to export Orders.");

  const exported = await exportOrdersCsv(actor, parseOrdersParams(searchParamsOf(request.url)));
  if (!exported.ok) {
    return exported.error.kind === "forbidden"
      ? plain(403, "Only an Owner can export Orders.")
      : plain(
          400,
          "The export couldn’t read those filters. Go back to the Orders screen and try again.",
        );
  }

  const { filename, csv } = exported.value;
  return new Response(csv, {
    headers: {
      ...PRIVATE,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
