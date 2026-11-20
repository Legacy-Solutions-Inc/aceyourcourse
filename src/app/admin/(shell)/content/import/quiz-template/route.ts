import { requireStaff } from "@/lib/admin/guard";
import {
  QUIZ_IMPORT_TEMPLATE_CSV,
  QUIZ_TEMPLATE_CSV_FILENAME,
} from "@/lib/content-import/template";
import { paths } from "@/paths";

// GET /admin/content/import/quiz-template (Phase 3, ticket 09; story 124):
// the quiz import's template CSV, as a download. Staff only, like every Admin
// route: the Staff Guard sends anyone else to sign-in or the 403 screen, and
// a closed Admin answers 404. Its example figure is in the same example-images
// zip as the card template's.

export async function GET(): Promise<Response> {
  await requireStaff(paths.admin.quizImportTemplate);
  return new Response(QUIZ_IMPORT_TEMPLATE_CSV, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${QUIZ_TEMPLATE_CSV_FILENAME}"`,
      "cache-control": "private, no-store",
    },
  });
}
