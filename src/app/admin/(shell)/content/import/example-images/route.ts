import { requireStaff } from "@/lib/admin/guard";
import { cardImportExampleZip, EXAMPLE_ZIP_FILENAME } from "@/lib/card-import/template";
import { paths } from "@/paths";

// GET /admin/content/import/example-images (Phase 3, ticket 06; story 124):
// the zip holding the template's example image, so importing the template
// unchanged succeeds. Staff only, like the template.

export async function GET(): Promise<Response> {
  await requireStaff(paths.admin.cardImportExampleImages);
  const zip = cardImportExampleZip();
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(zip.byteLength),
      "content-disposition": `attachment; filename="${EXAMPLE_ZIP_FILENAME}"`,
      "cache-control": "private, no-store",
    },
  });
}
