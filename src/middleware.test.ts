// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The middleware sets the CSP on every route but creates a Supabase client
// (one auth round trip) only for the signed-in and auth areas. Supabase's
// middleware client is the external boundary, so it is replaced. Supabase env
// is stubbed so the middleware runs its real session-refresh path.
const { createClient, getUser } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/supabase/middleware", () => ({ createClient }));

async function runMiddleware(
  pathname: string,
  {
    signedIn = false,
    supabaseConfigured = true,
    nodeEnv = "test",
    databaseUrl = "",
  }: {
    signedIn?: boolean;
    supabaseConfigured?: boolean;
    nodeEnv?: string;
    databaseUrl?: string;
  } = {},
) {
  if (supabaseConfigured) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  } else {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  }
  vi.stubEnv("NODE_ENV", nodeEnv);
  // The Admin's mode follows the database too: unset, it is sample (or closed
  // in production), whatever Supabase says.
  vi.stubEnv("DATABASE_URL", databaseUrl);
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

const LOCAL_DATABASE = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function cspOf(response: Response) {
  return response.headers.get("Content-Security-Policy") ?? "";
}

describe("middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it.each([
    "/",
    "/products",
    "/products/x",
    "/exams/ce",
    "/application",
    "/apple-icon",
    // The template dashboard is gone: it is a plain (404) Website path now.
    "/dashboard",
    "/dashboard/customers",
  ])("makes no Supabase call for the public route %s", async (pathname) => {
    await runMiddleware(pathname);
    expect(createClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

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

  it("sets the CSP on a session route too", async () => {
    const response = await runMiddleware("/app");
    expect(cspOf(response)).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  });

  it.each(["/app", "/app/library", "/auth/callback"])(
    "refreshes the session for %s",
    async (pathname) => {
      const response = await runMiddleware(pathname);
      expect(createClient).toHaveBeenCalledTimes(1);
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(cspOf(response)).toContain("'strict-dynamic'");
    },
  );

  // The Admin's sample mode signs Staff in with its own cookie (CONVENTIONS §1),
  // so /admin needs no Supabase session there, signed in or not.
  it.each(["/admin", "/admin/sign-in", "/admin/products", "/admin/denied"])(
    "makes no Supabase call for %s in sample mode, and still sets the CSP",
    async (pathname) => {
      const response = await runMiddleware(pathname, { signedIn: true });
      expect(createClient).not.toHaveBeenCalled();
      expect(getUser).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBeNull();
      expect(cspOf(response)).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(response.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
    },
  );

  // Live mode (ticket 16): the database and Supabase are both configured, and
  // Staff sign in with Google, so /admin refreshes the Supabase session.
  it.each(["/admin", "/admin/sign-in", "/admin/products"])(
    "refreshes the session for %s in live mode",
    async (pathname) => {
      const response = await runMiddleware(pathname, { databaseUrl: LOCAL_DATABASE });
      expect(createClient).toHaveBeenCalledTimes(1);
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(cspOf(response)).toContain("'strict-dynamic'");
    },
  );

  it("still makes no Supabase call for a public route in live mode", async () => {
    await runMiddleware("/products", { databaseUrl: LOCAL_DATABASE });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("makes no Supabase call for /admin with the Admin closed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Production with Supabase but no database: closed.
    await runMiddleware("/admin", { nodeEnv: "production" });
    expect(createClient).not.toHaveBeenCalled();
  });

  // Phase 2 adds the Member App and Admin gates; until then a session route only
  // refreshes the session and passes through, whoever is signed in.
  it.each([
    ["/app", false],
    ["/admin/x", true],
    ["/auth/callback", true],
    ["/auth/sign-in", true],
  ] as const)(
    "passes %s through without a redirect (signed in: %s)",
    async (pathname, signedIn) => {
      const response = await runMiddleware(pathname, { signedIn });
      expect(response.headers.get("location")).toBeNull();
      expect(response.status).toBe(200);
    },
  );

  it("passes a session route through in production without Supabase, with the CSP", async () => {
    // config.ts logs a loud fail-closed warning here; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await runMiddleware("/app", {
      supabaseConfigured: false,
      nodeEnv: "production",
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
    expect(cspOf(response)).toContain("'strict-dynamic'");
  });
});
