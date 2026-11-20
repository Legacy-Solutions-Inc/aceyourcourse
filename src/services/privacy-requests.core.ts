import { isPrivacyRequestOverdue } from "@/lib/member-app/privacy-requests";
import { roleRefusal } from "@/services/admin.schema";
import type { AdminPrivacyRequest, AdminResult, StaffActor } from "@/services/admin.types";
import { refused } from "@/services/content-editor.core";
import { ordinal } from "@/services/users.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Privacy Requests (Phase 3, ticket 18; story 133), shared by
// both arms. Owners only: an Editor is refused, as the Staff Guard refuses
// them the screen. The list is every Member's requests, soonest due first,
// each flagged when it's still open after its due date in Manila; a request
// whose Member's account is deleted stays, with no Member. Carrying a request
// out (export, delete, mark done) is ticket 19.
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN = "ONLY AN OWNER CAN SEE PRIVACY REQUESTS";

/** A Privacy Request with its Member, as an arm reads it: everything the list shows but the flag. */
export type StoredPrivacyRequest = Omit<AdminPrivacyRequest, "overdue">;

/** How an arm reads the Privacy Requests. */
export interface PrivacyRequestsStore {
  /** Every Member's Privacy Requests, open and done, in any order. */
  readRequests(): Promise<StoredPrivacyRequest[]>;
}

/** Pure: the soonest due first; requests due the same day, oldest first. */
const soonestDue = (a: StoredPrivacyRequest, b: StoredPrivacyRequest) =>
  ordinal(a.dueOn, b.dueOn) || ordinal(a.requestedAt, b.requestedAt) || ordinal(a.id, b.id);

/** The Admin seam's Privacy Request calls, over an arm's store. */
export function privacyRequestCalls(store: PrivacyRequestsStore) {
  async function listPrivacyRequests(
    actor: StaffActor,
  ): Promise<AdminResult<AdminPrivacyRequest[]>> {
    const refusal = roleRefusal(actor, "owner", FORBIDDEN);
    if (refusal) return refused(refusal);
    const now = new Date();
    const requests = (await store.readRequests()).sort(soonestDue);
    return {
      ok: true,
      value: requests.map((request) => ({
        ...request,
        overdue: isPrivacyRequestOverdue(request, now),
      })),
      tags: [],
    };
  }

  return { listPrivacyRequests };
}
