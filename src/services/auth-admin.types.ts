// ─────────────────────────────────────────────────────────────────────────────
// The auth admin (ticket 19; spec, Phase 3 planning decisions → Privacy
// Requests in the Admin): what deleting a Member's account asks of Supabase
// Auth, behind a small interface. The real one (src/lib/supabase/auth-admin.ts)
// uses the server-only secret-key client; the fake
// (src/services/auth-admin.fake.ts) stands in for it in tests, and in sample
// mode, where "Sign in as" makes no Supabase Users.
// ─────────────────────────────────────────────────────────────────────────────

/** What deleting a Supabase User did: done, or why not, for the server's log. */
export type AuthAdminResult = { ok: true } | { ok: false; message: string };

export interface AuthAdmin {
  /**
   * False on a server that can't delete Supabase Users at all (no secret
   * key): deleting an account then deletes nothing, rather than leaving a
   * User behind its deleted data.
   */
  readonly configured: boolean;
  /**
   * Deletes the Supabase User with this id, so the account can't sign in
   * again with its old data. A User already gone counts as deleted, so a
   * retry is safe. Never throws: a failure comes back as `ok: false`.
   */
  deleteUser(userId: string): Promise<AuthAdminResult>;
}
