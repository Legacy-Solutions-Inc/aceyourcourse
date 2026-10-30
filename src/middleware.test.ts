// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The middleware sets the CSP on every route but creates a Supabase client
// (one auth round trip) only for the signed-in and auth areas. Supabase's
// middleware client is the external boundary, so it is replaced. Supabase env
// is stubbed so the middleware runs its real, auth-enforcing path.
const { createClient, getUser } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/supabase/middleware", () => ({ createClient }));

async function runMiddleware(pathname: string, { signedIn = false } = {}) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.resetModules();

  getUser.mockResolvedValue({ data: { user: signedIn ? { id: "u1", app_metadata: {} } : null } });
  createClient.mockImplementation((_req: NextRequest, _nonce: string, csp: string) => {
    const res = NextResponse.next();
    res.headers.set("Content-Security-Policy", csp);
    return { supabaseClient: { auth: { getUser } }, res };
  });

  const { middleware } = await import("./middleware");
  return middleware(new NextRequest(new URL(pathname, "http://localhost:3000")));
}

function cspOf(response: Response) {
  return response.headers.get("Content-Security-Policy") ?? "";
}

describe("middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it.each(["/", "/products/x", "/exams/ce", "/application", "/apple-icon"])(
    "makes no Supabase call for the public route %s",
    async (pathname) => {
      await runMiddleware(pathname);
      expect(createClient).not.toHaveBeenCalled();
      expect(getUser).not.toHaveBeenCalled();
    },
  );

  it("still sets a nonce CSP on a public route", async () => {
    const response = await runMiddleware("/");
    expect(cspOf(response)).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  });

  it("passes the nonce on to the page for a public route", async () => {
    const response = await runMiddleware("/");
    const nonce = cspOf(response).match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
  });

  it.each(["/app", "/app/library", "/admin", "/auth/callback"])(
    "refreshes the session for %s",
    async (pathname) => {
      const response = await runMiddleware(pathname);
      expect(createClient).toHaveBeenCalledTimes(1);
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(cspOf(response)).toContain("'strict-dynamic'");
    },
  );

  it("still sends a signed-out visitor from /dashboard to sign in, with the CSP", async () => {
    const response = await runMiddleware("/dashboard/customers");
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/auth/sign-in");
    expect(cspOf(response)).toContain("'strict-dynamic'");
  });

  it("still sends a signed-in user from the auth screens to the dashboard", async () => {
    const response = await runMiddleware("/auth/sign-in", { signedIn: true });
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/dashboard");
  });
});
