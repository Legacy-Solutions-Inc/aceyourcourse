// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The Supabase session cookie (security review, Phase 5 ticket 05). It holds
// the session's access and refresh tokens, and only the server reads it: the
// server client, the middleware's refresh, and nothing in the browser (no
// page makes a browser Supabase client). So it is httpOnly, and a script
// injected into a page could never read it; Secure in production, and
// SameSite=Lax. Supabase's own client is real here, with its Auth API as the
// boundary: fetch answers as Supabase Auth does.

const SUPABASE_URL = "https://test.supabase.co";
const BEA = "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21";

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** A Supabase session for Bea, its access token ending at `expiresAt` (seconds). */
function session(refreshToken: string, expiresAt: number) {
  const accessToken = [
    base64url({ alg: "HS256", typ: "JWT" }),
    base64url({ sub: BEA, aud: "authenticated", role: "authenticated", exp: expiresAt }),
    "signature",
  ].join(".");
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: Math.max(expiresAt - Math.floor(Date.now() / 1000), 0),
    expires_at: expiresAt,
    user: {
      id: BEA,
      aud: "authenticated",
      role: "authenticated",
      email: "bea@example.com",
      app_metadata: { provider: "google" },
      user_metadata: {},
      created_at: "2026-11-01T00:00:00Z",
    },
  };
}

const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

/** Supabase Auth: a password sign-in or a refresh answers a new session, and /user its User. */
const supabaseAuth = vi.fn(async (input: RequestInfo | URL) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const fresh = session("refresh-token-2", inAnHour());
  return Response.json(url.pathname.endsWith("/user") ? fresh.user : fresh);
});

/** This server, as built for `nodeEnv`, with Supabase configured and its Auth API answering. */
function serverIn(nodeEnv: "development" | "production") {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("DATABASE_URL", "");
  vi.stubGlobal("fetch", supabaseAuth);
  vi.resetModules();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  supabaseAuth.mockClear();
});

describe("the Supabase session cookie", () => {
  it.each([
    { nodeEnv: "production", secure: true },
    // pnpm dev runs on plain http, so the cookie can't be Secure there.
    { nodeEnv: "development", secure: false },
  ] as const)(
    "is written httpOnly and SameSite=Lax by the server client in $nodeEnv (Secure: $secure)",
    async ({ nodeEnv, secure }) => {
      serverIn(nodeEnv);
      const set = vi.fn();
      const { createClient } = await import("./server");
      const supabase = createClient(Promise.resolve({ getAll: () => [], set }) as never);

      const { error } = await supabase.auth.signInWithPassword({
        email: "bea@example.com",
        password: "a password",
      });

      expect(error).toBeNull();
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ name: "sb", httpOnly: true, secure, sameSite: "lax", path: "/" }),
      );
    },
  );

  it("comes back to the browser refreshed, and httpOnly, when the middleware refreshes an expired session", async () => {
    serverIn("production");
    const expired = session("refresh-token-1", Math.floor(Date.now() / 1000) - 60);
    const request = new NextRequest(new URL("/app", "https://aceyourcourse.example"), {
      headers: { cookie: `sb=base64-${base64url(expired)}` },
    });
    const { middleware } = await import("@/middleware");

    const response = await middleware(request);

    // Supabase was asked to refresh with the browser's refresh token…
    const refresh = supabaseAuth.mock.calls.find(([input]) =>
      String(input).includes("grant_type=refresh_token"),
    );
    expect(refresh).toBeDefined();
    // …and the new session reaches the browser, where scripts can't read it.
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/(^|, )sb=base64-/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });
});
