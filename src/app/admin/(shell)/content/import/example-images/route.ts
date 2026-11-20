import { requireStaff } from "@/lib/admin/guard";
import { importExampleZip, EXAMPLE_ZIP_FILENAME } from "@/lib/content-import/template";
import { paths } from "@/paths";

// GET /admin/content/import/example-images (Phase 3, ticket 06; story 124):
// the zip holding the templates' example image, so importing either template
// unchanged succeeds. Staff only, like the template.

export async function GET(): Promise<Response> {
  await requireStaff(paths.admin.importExampleImages);
  const zip = importExampleZip();
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(zip.byteLength),
      "content-disposition": `attachment; filename="${EXAMPLE_ZIP_FILENAME}"`,
      "cache-control": "private, no-store",
    },
  });
}
