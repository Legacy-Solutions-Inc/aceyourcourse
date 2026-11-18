import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import {
  type AccessDecision,
  accessDecision,
  type MemberAccess,
  type RefusedDecision,
  type ShownRefusal,
} from "@/lib/member-app/access";
import { checkDevice } from "@/lib/member-app/device";
import { getMemberAppAccess } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { getStaffByEmail } from "@/services/admin";
import type { ContentKind } from "@/services/content.types";
import { getContentItem, listAccessPasses } from "@/services/member";
import type { ContentItem } from "@/services/member.types";

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
// checkContentAccess answers, and never redirects, so a page, a Server Action
// or a Route Handler (the Reviewer PDF pages, ticket 14) each shows the answer
// its way; shownRefusal is the redirect pages and actions share.
// It doesn't check consent, which isn't part of the rule: every caller runs
// the Member App's own checks first (requireMember, or a Route Handler's
// equivalent of it), as the Library and the item page do.
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

/** What opening one deck, quiz or Reviewer PDF finds. */
export type ContentAccess =
  | { status: "signed-out" }
  /** No such content: a wrong address, or one that was deleted. */
  | { status: "not-found" }
  | { status: "decided"; item: ContentItem; decision: AccessDecision };

/**
 * The access decision for the signed-in Member opening one deck, quiz or
 * Reviewer PDF, with the item as it is now. The address is the browser's, so
 * a kind or id that isn't one is simply not found.
 */
export async function checkContentAccess(kind: ContentKind, id: string): Promise<ContentAccess> {
  const member = await readMemberAccess();
  if (!member) return { status: "signed-out" };
  const item = await getContentItem(kind, id);
  if (!item) return { status: "not-found" };
  return { status: "decided", item, decision: accessDecision({ ...member, content: item }) };
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
