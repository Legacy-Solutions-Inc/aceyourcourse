import { getSampleStore } from "@/services/mock/sample-store";
import { privacyRequestCalls } from "@/services/privacy-requests.core";

// The sample arm of the Admin seam's Privacy Requests (Phase 3, ticket 18):
// the shared calls (src/services/privacy-requests.core.ts) over the in-memory
// sample store, which holds the Members and the requests they made. Like the
// database, a request outlives its Member's account, with no Member.

export const { listPrivacyRequests } = privacyRequestCalls({
  async readRequests() {
    const { members, privacyRequests } = getSampleStore();
    return structuredClone(
      privacyRequests.map(({ userId, ...request }) => {
        const found = members.find((member) => member.userId === userId);
        return {
          ...request,
          member: found ? { userId, email: found.email, name: found.name } : null,
        };
      }),
    );
  },
});
