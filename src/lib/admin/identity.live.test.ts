// @vitest-environment node
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The identity module's live arm (ticket 16): Google sign-in through
// Supabase, and the development password sign-in (ticket 19). Supabase's
// server client and next/headers are the external boundary, so both are
// replaced: the client's auth calls are mocks, and the cookie jar is a Map.
// Nothing here reaches a Supabase. Vitest runs with NODE_ENV "test", where
// only a Google (oauth) session counts; a test that needs `pnpm dev` stubs
// NODE_ENV "development".

const { auth, jar } = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    getClaims: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    signOut: vi.fn(),
  },
  jar: new Map<string, string>(),
}));

vi.mock("@/lib/admin/mode", () => ({ adminMode: "live" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    delete: (name: string) => jar.delete(name),
  }),
}));

const OWNER = "angel@aceyourcourse.ph";

/** A Supabase User as getUser() gives it after Google sign-in. */
function googleUser(overrides: Partial<User> = {}, profile: Record<string, unknown> = {}): User {
  return {
    id: "8a0c7f8e-0000-4000-8000-000000000001",
    app_metadata: { provider: "google" },
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-11-04T00:00:00Z",
    email: OWNER,
    email_confirmed_at: "2026-11-04T00:00:00Z",
    identities: [
      {
        id: "google-1",
        identity_id: "3c3b6f1e-0000-4000-8000-000000000001",
        user_id: "8a0c7f8e-0000-4000-8000-000000000001",
        provider: "google",
        identity_data: {
          email: OWNER,
          email_verified: true,
          full_name: "Angel Rose L. Lepaña",
          ...profile,
        },
      },
    ],
    ...overrides,
  };
}

const user = (value: User | null) => ({ data: { user: value }, error: null });

const USER_ID = "8a0c7f8e-0000-4000-8000-000000000001";

/** getClaims() for a session that signed in with these methods (its verified amr). */
function claims(amr: unknown, sub = USER_ID) {
  return {
    data: { claims: { sub, amr }, header: { alg: "ES256" }, signature: new Uint8Array() },
    error: null,
  };
}
const signedInWith = (...methods: string[]) =>
  auth.getClaims.mockResolvedValue(
    claims(methods.map((method) => ({ method, timestamp: 1_793_750_400 }))),
  );

/** Supabase's public auth settings, GET /auth/v1/settings. */
const providers = (external: { google: boolean; email: boolean }) =>
  vi.fn(async () => Response.json({ external }));

async function loadIdentity() {
  return import("./identity");
}

describe("the identity module, live mode", () => {
  beforeEach(() => {
    jar.clear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000/");
    vi.resetModules();
    signedInWith("oauth");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("getIdentity", () => {
    it("gives a verified Google email, lowercased, and the Google profile's name", async () => {
      auth.getUser.mockResolvedValue(user(googleUser({ email: "Angel@AceYourCourse.ph" })));
      const { getIdentity } = await loadIdentity();

      expect(await getIdentity()).toEqual({ email: OWNER, name: "Angel Rose L. Lepaña" });
      expect(auth.getUser).toHaveBeenCalledTimes(1);
      expect(auth.getClaims).toHaveBeenCalledTimes(1);
      // Decisions come from getUser() and getClaims(), verified with Supabase, never the cookie alone.
      expect(auth.getSession).not.toHaveBeenCalled();
    });

    it("counts Google's email_verified when Supabase hasn't stamped a confirmation", async () => {
      auth.getUser.mockResolvedValue(user(googleUser({ email_confirmed_at: undefined })));
      const { getIdentity } = await loadIdentity();

      expect(await getIdentity()).toEqual({ email: OWNER, name: "Angel Rose L. Lepaña" });
    });

    it("takes the name from a password sign-in's identity too, as CI's e2e Users have it", async () => {
      auth.getUser.mockResolvedValue(
        user(
          googleUser({
            identities: [
              {
                id: "email-1",
                identity_id: "3c3b6f1e-0000-4000-8000-000000000002",
                user_id: "8a0c7f8e-0000-4000-8000-000000000001",
                provider: "email",
                identity_data: { email: OWNER, email_verified: false, full_name: "Angel" },
              },
            ],
          }),
        ),
      );
      const { getIdentity } = await loadIdentity();

      expect(await getIdentity()).toEqual({ email: OWNER, name: "Angel" });
    });

    it("gives no name when the profile has none: the staff list's name shows instead", async () => {
      auth.getUser.mockResolvedValue(user(googleUser({}, { full_name: undefined, name: "  " })));
      const { getIdentity } = await loadIdentity();

      expect(await getIdentity()).toEqual({ email: OWNER, name: null });
    });

    it("is null when signed out, or when Supabase can't verify the session", async () => {
      const { getIdentity } = await loadIdentity();

      auth.getUser.mockResolvedValue(user(null));
      expect(await getIdentity()).toBeNull();

      auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("JWT expired") });
      expect(await getIdentity()).toBeNull();

      auth.getUser.mockRejectedValue(new TypeError("fetch failed"));
      expect(await getIdentity()).toBeNull();
    });

    it("never honours the sample cookie", async () => {
      jar.set("ayc_admin_sample", OWNER);
      auth.getUser.mockResolvedValue(user(null));
      const { getIdentity } = await loadIdentity();

      expect(await getIdentity()).toBeNull();
    });

    it("reads nothing from user_metadata: a role or email set there is ignored", async () => {
      auth.getUser.mockResolvedValue(
        user(
          googleUser(
            {
              email: "juan.delacruz@gmail.com",
              user_metadata: { role: "owner", email: OWNER, full_name: "The Owner" },
            },
            { email: "juan.delacruz@gmail.com", full_name: "Juan Dela Cruz" },
          ),
        ),
      );
      const { getIdentity } = await loadIdentity();

      expect(await getIdentity()).toEqual({
        email: "juan.delacruz@gmail.com",
        name: "Juan Dela Cruz",
      });
    });
  });

  describe("the session's sign-in method (ticket 19)", () => {
    /** Loads the module as `pnpm dev` (development), a production build, or Vitest (test). */
    async function identityIn(nodeEnv: string) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.resetModules();
      return loadIdentity();
    }

    it.each(["development", "production", "test"])(
      "counts a Google (oauth) session in %s",
      async (nodeEnv) => {
        auth.getUser.mockResolvedValue(user(googleUser()));
        signedInWith("oauth");
        const { getIdentity } = await identityIn(nodeEnv);

        expect(await getIdentity()).toEqual({ email: OWNER, name: "Angel Rose L. Lepaña" });
      },
    );

    it("counts a confirmed password session under pnpm dev", async () => {
      auth.getUser.mockResolvedValue(user(googleUser()));
      signedInWith("password");
      const { getIdentity } = await identityIn("development");

      expect(await getIdentity()).toEqual({ email: OWNER, name: "Angel Rose L. Lepaña" });
    });

    it.each(["production", "test"])(
      "treats a confirmed password session as signed out in %s, whatever user_metadata says",
      async (nodeEnv) => {
        auth.getUser.mockResolvedValue(
          user(googleUser({ user_metadata: { provider: "google", role: "owner", amr: "oauth" } })),
        );
        signedInWith("password");
        const { getIdentity, getSignInAttempt } = await identityIn(nodeEnv);

        expect(await getSignInAttempt()).toEqual({ status: "signed-out" });
        expect(await getIdentity()).toBeNull();
      },
    );

    it.each(["development", "production", "test"])(
      "treats otp, a refresh alone, an empty or a missing amr as signed out in %s",
      async (nodeEnv) => {
        auth.getUser.mockResolvedValue(user(googleUser()));
        const { getSignInAttempt } = await identityIn(nodeEnv);

        for (const amr of [[{ method: "otp" }], [{ method: "token_refresh" }], [], undefined]) {
          auth.getClaims.mockResolvedValue(claims(amr));
          expect(await getSignInAttempt()).toEqual({ status: "signed-out" });
        }
      },
    );

    it("treats getClaims failing, refusing or finding no session as signed out, without crashing", async () => {
      auth.getUser.mockResolvedValue(user(googleUser()));
      const { getSignInAttempt } = await identityIn("development");

      auth.getClaims.mockResolvedValue({ data: null, error: new Error("Invalid JWT signature") });
      expect(await getSignInAttempt()).toEqual({ status: "signed-out" });

      auth.getClaims.mockResolvedValue({ data: null, error: null });
      expect(await getSignInAttempt()).toEqual({ status: "signed-out" });

      auth.getClaims.mockRejectedValue(new TypeError("fetch failed"));
      expect(await getSignInAttempt()).toEqual({ status: "signed-out" });
    });

    it("treats claims for another User than getUser's as signed out", async () => {
      auth.getUser.mockResolvedValue(user(googleUser()));
      auth.getClaims.mockResolvedValue(
        claims([{ method: "oauth" }], "8a0c7f8e-0000-4000-8000-000000000999"),
      );
      const { getSignInAttempt } = await identityIn("production");

      expect(await getSignInAttempt()).toEqual({ status: "signed-out" });
    });
  });

  describe("passwordSignInOffered (ticket 19)", () => {
    it("is true under pnpm dev while Supabase says Email is on", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const fetch = providers({ google: false, email: true });
      vi.stubGlobal("fetch", fetch);
      const { passwordSignInOffered } = await loadIdentity();

      expect(await passwordSignInOffered()).toBe(true);
      expect(String(fetch.mock.calls[0]?.at(0))).toBe("http://127.0.0.1:54321/auth/v1/settings");
    });

    it("is false under pnpm dev when Email is off, or Supabase doesn't answer", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const { passwordSignInOffered } = await loadIdentity();

      vi.stubGlobal("fetch", providers({ google: true, email: false }));
      expect(await passwordSignInOffered()).toBe(false);

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("Bad Gateway", { status: 502 })),
      );
      expect(await passwordSignInOffered()).toBe(false);

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("fetch failed");
        }),
      );
      expect(await passwordSignInOffered()).toBe(false);
    });

    it.each(["production", "test"])(
      "is false in %s without asking Supabase, even with Email on",
      async (nodeEnv) => {
        vi.stubEnv("NODE_ENV", nodeEnv);
        const fetch = providers({ google: true, email: true });
        vi.stubGlobal("fetch", fetch);
        const { passwordSignInOffered } = await loadIdentity();

        expect(await passwordSignInOffered()).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
      },
    );
  });

  describe("startPasswordSession (ticket 19)", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("signs in to Supabase with the email and password", async () => {
      auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
      const { startPasswordSession } = await loadIdentity();

      expect(await startPasswordSession(OWNER, "correct horse")).toEqual({ ok: true });
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: OWNER,
        password: "correct horse",
      });
    });

    it.each([
      ["invalid_credentials", 400, "mismatch"],
      ["over_request_rate_limit", 429, "rate-limited"],
      ["email_provider_disabled", 400, "email-off"],
      ["email_not_confirmed", 400, "unconfirmed"],
      ["unexpected_failure", 500, "failed"],
    ])("says why Supabase refused (%s)", async (code, status, problem) => {
      const { AuthApiError } = await import("@supabase/supabase-js");
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError("refused", status, code),
      });
      const { startPasswordSession } = await loadIdentity();

      expect(await startPasswordSession(OWNER, "wrong")).toEqual({ ok: false, problem });
    });

    it("says Supabase didn't answer on a network error, returned or thrown", async () => {
      const { AuthRetryableFetchError } = await import("@supabase/supabase-js");
      const { startPasswordSession } = await loadIdentity();

      auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthRetryableFetchError("fetch failed", 0),
      });
      expect(await startPasswordSession(OWNER, "pw")).toEqual({
        ok: false,
        problem: "unreachable",
      });

      auth.signInWithPassword.mockRejectedValue(new TypeError("fetch failed"));
      expect(await startPasswordSession(OWNER, "pw")).toEqual({
        ok: false,
        problem: "unreachable",
      });
    });

    it("refuses outside pnpm dev, never asking Supabase", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { startPasswordSession } = await loadIdentity();

      await expect(startPasswordSession(OWNER, "pw")).rejects.toThrow(
        "The password sign-in runs only under pnpm dev, in live mode.",
      );
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe("getSignInAttempt", () => {
    it("is unverified for an email neither Supabase nor Google verified", async () => {
      auth.getUser.mockResolvedValue(
        user(googleUser({ email_confirmed_at: undefined }, { email_verified: false })),
      );
      const { getIdentity, getSignInAttempt } = await loadIdentity();

      expect(await getSignInAttempt()).toEqual({ status: "unverified", email: OWNER });
      expect(await getIdentity()).toBeNull();
    });

    it("doesn't take another identity's email_verified for this email", async () => {
      auth.getUser.mockResolvedValue(
        user(googleUser({ email_confirmed_at: undefined }, { email: "someone.else@gmail.com" })),
      );
      const { getSignInAttempt } = await loadIdentity();

      expect(await getSignInAttempt()).toEqual({ status: "unverified", email: OWNER });
    });
  });

  describe("startGoogleSignIn", () => {
    const settings = (google: boolean) =>
      vi.fn(async () => Response.json({ external: { google, email: false } }));

    it("starts Google's OAuth flow back through the callback, asking which account", async () => {
      const fetch = settings(true);
      vi.stubGlobal("fetch", fetch);
      auth.signInWithOAuth.mockResolvedValue({
        data: {
          provider: "google",
          url: "http://127.0.0.1:54321/auth/v1/authorize?provider=google",
        },
        error: null,
      });
      const { startGoogleSignIn } = await loadIdentity();

      expect(await startGoogleSignIn("/admin/products?product=prd-005")).toEqual({
        ok: true,
        url: "http://127.0.0.1:54321/auth/v1/authorize?provider=google",
      });
      expect(String(fetch.mock.calls[0]?.at(0))).toBe("http://127.0.0.1:54321/auth/v1/settings");
      expect(auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "http://localhost:3000/auth/callback?next=%2Fadmin%2Fproducts%3Fproduct%3Dprd-005",
          queryParams: { prompt: "select_account" },
        },
      });
    });

    it.each([
      ["another site", "https://evil.example/admin"],
      ["another Surface", "/app"],
      ["nothing", undefined],
    ])("sends `next` back as the Overview when it names %s", async (_label, next) => {
      vi.stubGlobal("fetch", settings(true));
      auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://x.invalid" }, error: null });
      const { startGoogleSignIn } = await loadIdentity();

      await startGoogleSignIn(next);
      expect(auth.signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(
        "http://localhost:3000/auth/callback?next=%2Fadmin",
      );
    });

    it("still starts Google when the settings don't mention Email", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ external: { google: true } })),
      );
      auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://x.invalid" }, error: null });
      const { startGoogleSignIn } = await loadIdentity();

      expect(await startGoogleSignIn("/admin")).toEqual({ ok: true, url: "https://x.invalid" });
    });

    it("says Google isn't set up when the provider is off, without starting the flow", async () => {
      vi.stubGlobal("fetch", settings(false));
      const { startGoogleSignIn } = await loadIdentity();

      expect(await startGoogleSignIn("/admin")).toEqual({ ok: false, reason: "not-set-up" });
      expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    });

    it("says Supabase didn't answer when its settings can't be read", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("fetch failed");
        }),
      );
      const { startGoogleSignIn } = await loadIdentity();

      expect(await startGoogleSignIn("/admin")).toEqual({ ok: false, reason: "unreachable" });
      expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    });
  });

  describe("finishGoogleSignIn", () => {
    it("exchanges the code for a session", async () => {
      auth.exchangeCodeForSession.mockResolvedValue({ error: null });
      const { finishGoogleSignIn } = await loadIdentity();

      expect(await finishGoogleSignIn("valid")).toBe(true);
      expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("valid");
    });

    it("is false for a code Supabase refuses, or when it can't be reached", async () => {
      const { finishGoogleSignIn } = await loadIdentity();

      auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid grant") });
      expect(await finishGoogleSignIn("expired")).toBe(false);

      auth.exchangeCodeForSession.mockRejectedValue(new TypeError("fetch failed"));
      expect(await finishGoogleSignIn("valid")).toBe(false);
    });
  });

  describe("endSession", () => {
    it("signs out of Supabase, and drops any sample cookie", async () => {
      jar.set("ayc_admin_sample", OWNER);
      auth.signOut.mockResolvedValue({ error: null });
      const { endSession } = await loadIdentity();

      await endSession();
      expect(auth.signOut).toHaveBeenCalledTimes(1);
      expect(jar.has("ayc_admin_sample")).toBe(false);
    });
  });

  describe("the sample sign-in", () => {
    it("is refused, and lists nobody", async () => {
      const { listSampleUsers, startSampleSession } = await loadIdentity();

      expect(listSampleUsers()).toEqual([]);
      await expect(startSampleSession(OWNER)).rejects.toThrow(
        "The sample sign-in exists only with sample data.",
      );
    });
  });
});
