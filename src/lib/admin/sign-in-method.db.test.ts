import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";

import { describeWithStorage, openTestStorage } from "../../../test/storage-database";
import { signInMethodCounts } from "./sign-in-method";

// The fact the method rule leans on (ticket 19), against local Supabase: a
// password session's verified claims say "password", and still do after the
// token refreshes, so a refreshed password session is never mistaken for a
// Google one, or dropped under `pnpm dev`. The Staff Guard reads the method
// from getClaims(), as here. Skips, saying why, without
// TEST_SUPABASE_SECRET_KEY: it runs in CI.

const opened = await openTestStorage();

function local() {
  if (!opened.storage) throw new Error("No local Supabase: this suite should have been skipped.");
  return opened.storage;
}

/** A client of its own for the User's sign-in, so the admin client keeps its secret key. */
const signInClient = () =>
  createClient(local().supabaseUrl, process.env.TEST_SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

const methodsOf = (amr: unknown) =>
  Array.isArray(amr) ? amr.map((entry: { method?: unknown }) => entry.method) : amr;

describeWithStorage("a password session's sign-in method", [opened], () => {
  it("says password, before and after the token refreshes", async () => {
    const admin = local().client.auth.admin;
    const email = `password-method-${crypto.randomUUID()}@example.com`;
    const password = crypto.randomUUID();
    const created = await admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;

    try {
      const auth = signInClient().auth;
      const signedIn = await auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      const first = await auth.getClaims(signedIn.data.session.access_token);
      if (!first.data) throw first.error ?? new Error("no claims");
      expect(methodsOf(first.data.claims.amr)).toEqual(["password"]);

      const refreshed = await auth.refreshSession({
        refresh_token: signedIn.data.session.refresh_token,
      });
      if (refreshed.error || !refreshed.data.session)
        throw refreshed.error ?? new Error("no session");
      // A new session token pair: the refresh token rotates.
      expect(refreshed.data.session.refresh_token).not.toBe(signedIn.data.session.refresh_token);

      const after = await auth.getClaims(refreshed.data.session.access_token);
      if (!after.data) throw after.error ?? new Error("no claims");
      expect(methodsOf(after.data.claims.amr)).toEqual(["password"]);
      expect(signInMethodCounts(after.data.claims.amr, "development")).toBe(true);
      expect(signInMethodCounts(after.data.claims.amr, "production")).toBe(false);
    } finally {
      await admin.deleteUser(created.data.user.id);
    }
  });
});
