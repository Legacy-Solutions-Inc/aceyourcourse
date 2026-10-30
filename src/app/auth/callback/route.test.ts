// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

// The callback exchanges the OAuth `code` for a session and sends the User on.
// Supabase's server client is the external boundary, so it is replaced; the
// cookie store is only passed through to it.
const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { exchangeCodeForSession } }),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const ORIGIN = "http://localhost:3000";

async function callback(query: string) {
  const response = await GET(new Request(`${ORIGIN}/auth/callback${query}`));
  return new URL(response.headers.get("location") ?? "");
}

describe("GET /auth/callback", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to a safe `next` path after a successful exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const location = await callback("?code=valid&next=/products");

    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid");
    expect(location.href).toBe(`${ORIGIN}/products`);
  });

  it("redirects Home after a successful exchange with no `next`", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const location = await callback("?code=valid");

    expect(location.href).toBe(`${ORIGIN}/`);
  });

  it.each([
    ["there is no code", ""],
    ["the code is empty", "?code=&next=/products"],
  ])("redirects Home without an exchange when %s", async (_label, query) => {
    const location = await callback(query);

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location.href).toBe(`${ORIGIN}/`);
  });

  it("redirects Home when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid grant") });

    const location = await callback("?code=expired&next=/products");

    expect(location.href).toBe(`${ORIGIN}/`);
  });

  it.each([
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash URL", "/\\evil.example"],
    ["an absolute URL", "https://evil.example"],
    ["a relative path", "products"],
  ])("ignores %s in `next` and redirects Home on the same origin", async (_label, next) => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const location = await callback(`?code=valid&next=${encodeURIComponent(next)}`);

    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/");
  });
});
