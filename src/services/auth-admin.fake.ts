import type { AuthAdmin, AuthAdminResult } from "@/services/auth-admin.types";

// The fake auth admin (ticket 19): stands in for Supabase Auth in tests, and
// in sample mode, where "Sign in as" makes no Supabase Users, so there is
// never one to delete. It keeps the User ids it deleted, in order, and can be
// told to fail its next calls, as Supabase might.

export interface FakeAuthAdmin extends AuthAdmin {
  /** The User ids deleted, in the order asked, retries too. */
  readonly deleted: readonly string[];
  /** Makes the next `times` deletes fail, deleting nothing. */
  failNext(times?: number): void;
}

/** Why the fake's failing deletes failed: as Supabase says when it's unreachable. */
export const FAKE_AUTH_FAILURE = "Supabase Auth didn't answer.";

/** `configured: false` stands in for a server without the secret key. */
export function createFakeAuthAdmin({ configured = true } = {}): FakeAuthAdmin {
  const deleted: string[] = [];
  let failures = 0;
  return {
    configured,
    deleted,
    failNext(times = 1) {
      failures = times;
    },
    async deleteUser(userId): Promise<AuthAdminResult> {
      if (!configured) return { ok: false, message: "No secret key." };
      if (failures > 0) {
        failures -= 1;
        return { ok: false, message: FAKE_AUTH_FAILURE };
      }
      deleted.push(userId);
      return { ok: true };
    },
  };
}
