import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import type { MemberAccess, RefusedDecision, ShownRefusal } from "@/lib/member-app/access";
import { checkDevice } from "@/lib/member-app/device";
import { getMemberAppAccess, requireMember } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { getStaffByEmail } from "@/services/admin";
import { listAccessPasses } from "@/services/member";
import type { Member } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The access decision on the server (spec, Phase 3 → Access decision seam):
// it gathers the pure rule's inputs (src/lib/member-app/access.ts) for the
// signed-in Member and asks it. Every protected read goes through here: a
// deck's cards, a quiz's questions, a Reviewer PDF's pages, and later video.
// Nothing reads protected content around it, and nothing the browser sends
// decides it: the gate and the staff list are read on every call, as the
// Staff Guard reads them, so removed Staff are Members again at once; the
// device is this request's token; the passes are the Member's own.
//
// The Member seam's study calls take readMemberAccess's answer and decide each
// item with it (src/services/study-access.ts). requireMemberAccess runs the
// Member App's own checks first (consent isn't part of the rule), for the
// study actions and the Reviewer PDF page endpoint (ticket 14); shownRefusal
// is the redirect pages and actions share.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The signed-in Member's side of the access decision, read once per request
 * (the Library decides every item with it), or null when nobody is signed in.
 * The time is the time of the request.
 */
export const readMemberAccess = cache(async (): Promise<MemberAccess | null> => {
  const access = await getMemberAppAccess();
  if (access.status === "signed-out") return null;
  const { userId, email } = access.user;
  const [device, staff, passes] = await Promise.all([
    checkDevice(userId),
    getStaffByEmail(email),
    listAccessPasses(userId),
  ]);
  return {
    gate: access.status,
    device,
    // The staff list, read now: a removed Staff User is a Member like any other.
    activeStaff: staff !== null,
    passes: passes.map(({ examCode, endsAt }) => ({ examCode, endsAt })),
    now: new Date(),
  };
});

/**
 * The signed-in Member, past the Member App's checks (the gate, consent and
 * the Active Device, which redirect anyone they stop), and their side of the
 * access decision now: what the study actions and the Reviewer PDF page
 * endpoint start with. `from` is where the checks' screens come back to.
 */
export async function requireMemberAccess(
  from: string,
): Promise<{ member: Member; access: MemberAccess }> {
  const member = await requireMember(from);
  const access = await readMemberAccess();
  if (!access) redirect(paths.memberApp.signIn(from));
  return { member, access };
}

/**
 * Where a refusal goes, for a page or a Server Action that was refused (a
 * deck's player, ticket 08): the gate's refusal and the Active Device's have
 * screens of their own, which this redirects to, coming back to `from`. The
 * rest are shown in place of the content, so they're given back.
 */
export function shownRefusal(decision: RefusedDecision, from: string): ShownRefusal {
  if (decision.outcome === "not-open-yet") redirect(paths.memberApp.notOpenYet);
  if (decision.outcome === "no-token" || decision.outcome === "device-replaced") {
    redirect(paths.memberApp.device(from));
  }
  return decision;
}
