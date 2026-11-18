import { requireStaff } from "@/lib/admin/guard";
import {
  CARD_IMPORT_TEMPLATE_CSV,
  CARD_TEMPLATE_CSV_FILENAME,
} from "@/lib/content-import/template";
import { paths } from "@/paths";

// GET /admin/content/import/template (Phase 3, ticket 06; story 124): the
// card import's template CSV, as a download. Staff only, like every Admin
// route: the Staff Guard sends anyone else to sign-in or the 403 screen, and
// a closed Admin answers 404.

export async function GET(): Promise<Response> {
  await requireStaff(paths.admin.cardImportTemplate);
  return new Response(CARD_IMPORT_TEMPLATE_CSV, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${CARD_TEMPLATE_CSV_FILENAME}"`,
      "cache-control": "private, no-store",
    },
  });
}
