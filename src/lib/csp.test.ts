import { describe, expect, it } from "vitest";

import { buildCsp } from "./csp";

const NONCE = "test-nonce-123";

describe("buildCsp", () => {
  it("prod: nonce + strict-dynamic script-src, locked frame/object, no unsafe-eval", () => {
    const csp = buildCsp(NONCE, { isDev: false });
    expect(csp).toContain(`script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("locks base-uri to 'none' (no <base> element in this template)", () => {
    expect(buildCsp(NONCE, { isDev: false })).toContain("base-uri 'none'");
    expect(buildCsp(NONCE, { isDev: true })).toContain("base-uri 'none'");
    expect(buildCsp(NONCE, { isDev: false })).not.toContain("base-uri 'self'");
  });

  it("prod: adds upgrade-insecure-requests (valueless, no trailing space)", () => {
    const csp = buildCsp(NONCE, { isDev: false });
    expect(csp).toContain("upgrade-insecure-requests");
    // Valueless directive must not emit a dangling "name " with no value.
    expect(csp).not.toContain("upgrade-insecure-requests ");
  });

  it("dev: includes 'unsafe-eval' for HMR and omits upgrade-insecure-requests", () => {
    const csp = buildCsp(NONCE, { isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    // Would break the http/ws localhost origins dev relies on.
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("derives supabase https + wss origins into connect-src", () => {
    const csp = buildCsp(NONCE, { isDev: false, supabaseUrl: "https://abc.supabase.co" });
    expect(csp).toContain("https://abc.supabase.co");
    expect(csp).toContain("wss://abc.supabase.co");
  });

  it("without supabaseUrl, connect-src is just 'self' in prod", () => {
    const csp = buildCsp(NONCE, { isDev: false });
    expect(csp).toMatch(/connect-src 'self'(;|$)/);
  });

  it("session replay OFF (default): no worker-src directive", () => {
    expect(buildCsp(NONCE, { isDev: false })).not.toContain("worker-src");
    expect(buildCsp(NONCE, { isDev: false, sessionReplay: false })).not.toContain("worker-src");
  });

  it("session replay ON: adds worker-src 'self' blob:", () => {
    const csp = buildCsp(NONCE, { isDev: false, sessionReplay: true });
    expect(csp).toContain("worker-src 'self' blob:");
  });
});
