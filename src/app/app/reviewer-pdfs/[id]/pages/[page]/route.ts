import { requireMemberAccess } from "@/lib/member-app/access-check";
import { PAGE_CACHE_SECONDS, pageFromAddress } from "@/lib/reviewer-pdfs/reader";
import { paths } from "@/paths";
import { readReviewerPage } from "@/services/member";
import type { ReviewerPage } from "@/services/member.types";
import { sharpStamper } from "@/services/page-images.sharp";

// GET /app/reviewer-pdfs/<id>/pages/<page> (Phase 3, ticket 14; spec, Phase 3
// → Burned-in watermark): the protected page endpoint, the only way a Member
// gets a Reviewer PDF's page. Every request runs, in order:
//   1. the Member App's checks: the gate, consent, then the Active Device
//      (requireMember), which send anyone they stop to their screen
//      ("Session ended" for a replaced device, "Use the Member App on this
//      device" for one with no token), with no page;
//   2. the access decision for the Reviewer PDF, which refuses a locked,
//      expired, Draft or Unpublished one with 403 and no image bytes;
//   3. the page number's range: 404 below 1, past the last, or not a number;
//   4. the clean page, read from the private bucket, and
//   5. stamped with the Member's email and short Member ID (sharp), which
//      also records the page viewed and the day as a Study Day.
// Only the Member's own browser may keep the stamped page, and briefly
// (private, max-age): never a CDN, never `public` or `s-maxage`, and no copy
// is stored. Vary: Cookie keeps another Member signing in on the same browser
// from being shown it. The clean page and the original PDF are never sent.

const NOT_STORED = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

/** The response for each answer: the stamped page, or why there's none, with no image bytes. */
function responseFor(answer: ReviewerPage): Response {
  if (answer.status === "refused") {
    return Response.json(
      { refused: answer.decision.outcome },
      { status: 403, headers: NOT_STORED },
    );
  }
  if (answer.status === "not-found") {
    return new Response("Not found", { status: 404, headers: NOT_STORED });
  }
  return new Response(answer.image, {
    headers: {
      "cache-control": `private, max-age=${PAGE_CACHE_SECONDS}`,
      vary: "Cookie",
      "x-content-type-options": "nosniff",
      "content-type": "image/webp",
      "content-length": String(answer.image.byteLength),
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; page: string }> },
): Promise<Response> {
  const { id, page } = await params;
  const { member, access } = await requireMemberAccess(paths.memberApp.content("reviewer-pdf", id));
  // An address that names no page is page 0, which the seam refuses after the access decision.
  const number = pageFromAddress(page) ?? 0;
  return responseFor(
    await readReviewerPage(
      member.userId,
      { reviewerPdfId: id, page: number },
      access,
      sharpStamper,
    ),
  );
}
