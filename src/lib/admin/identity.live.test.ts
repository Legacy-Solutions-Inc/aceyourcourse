// @vitest-environment node
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The identity module's live arm (ticket 16): Google sign-in through
// Supabase. Supabase's server client and next/headers are the external
// boundary, so both are replaced: the client's auth calls are mocks, and the
// cookie jar is a Map. Nothing here reaches a Supabase.

const { auth, jar } = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    signInWithOAuth: vi.fn(),
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
      // Decisions come from getUser(), verified with Supabase, never the cookie alone.
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
