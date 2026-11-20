import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getQuestionFigureForAdmin } from "@/services/admin";

// GET /admin/content/quiz/figure/<question> (Phase 3, ticket 09): a question's
// figure from the private content bucket, for the quiz screen. Staff only,
// like every Admin route: the Staff Guard sends anyone else to sign-in or the
// 403 screen, and a closed Admin answers 404. The bucket has no public URLs,
// and nothing here is cached anywhere but this Staff User's browser session.
// Members get a figure only through the Member App's own checks (ticket 11).

const PRIVATE = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ question: string }> },
): Promise<Response> {
  const { question } = await params;
  const actor = await requireStaff(paths.admin.questionFigure(question));
  const figure = await getQuestionFigureForAdmin(actor, question);
  if (!figure) return new Response("Not found", { status: 404, headers: PRIVATE });
  return new Response(figure.bytes, {
    headers: {
      ...PRIVATE,
      "content-type": figure.contentType,
      "content-length": String(figure.bytes.byteLength),
    },
  });
}
