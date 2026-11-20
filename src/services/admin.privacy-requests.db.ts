import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { privacyRequestFieldsFromRow } from "@/services/member.db";
import { privacyRequestCalls } from "@/services/privacy-requests.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Privacy Requests on Postgres (Phase 3, ticket 18): the
// shared calls (src/services/privacy-requests.core.ts) over privacy_requests,
// each with its Member, or none once their account is deleted (the request's
// user_id is emptied then). Drizzle bypasses RLS, so authorisation is the
// seam's role check and the Staff Guard (coding standards §3).
// ─────────────────────────────────────────────────────────────────────────────

const { members, privacyRequests } = schema;

export const { listPrivacyRequests } = privacyRequestCalls({
  async readRequests() {
    try {
      const rows = await getDb()
        .select({
          request: privacyRequests,
          member: { userId: members.userId, email: members.email, name: members.name },
        })
        .from(privacyRequests)
        .leftJoin(members, eq(members.userId, privacyRequests.userId));
      return rows.map(({ request, member }) => ({
        ...privacyRequestFieldsFromRow(request),
        member,
      }));
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
});
