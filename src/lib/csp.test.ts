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

  it("lets a form's redirect go to PayMongo's checkout, and nowhere else off the site (ticket 04)", () => {
    for (const isDev of [false, true]) {
      expect(buildCsp(NONCE, { isDev })).toContain(
        "form-action 'self' https://checkout.paymongo.com;",
      );
    }
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

  it("img-src: https: everywhere, which covers hosted Storage; local Storage in dev only", () => {
    const imgSrc = (isDev: boolean) =>
      buildCsp(NONCE, { isDev })
        .split("; ")
        .find((directive) => directive.startsWith("img-src "));
    expect(imgSrc(false)).toBe("img-src 'self' data: blob: https:");
    expect(imgSrc(true)).toBe("img-src 'self' data: blob: https: http://127.0.0.1:54321");
  });

  it("derives supabase https + wss origins into connect-src", () => {
    const csp = buildCsp(NONCE, { isDev: false, supabaseUrl: "https://abc.supabase.co" });
    expect(csp).toContain("https://abc.supabase.co");
    expect(csp).toContain("wss://abc.supabase.co");
  });

  it("without supabaseUrl, connect-src is 'self' and VdoCipher's upload host in prod", () => {
    const csp = buildCsp(NONCE, { isDev: false });
    expect(csp).toMatch(/connect-src 'self' https:\/\/\*\.amazonaws\.com(;|$)/);
  });

  it("adds only VdoCipher's player as a frame and a script host, and its upload host as a connection (Phase 5, tickets 02 and 04)", () => {
    const directive = (name: string, isDev = false) =>
      buildCsp(NONCE, { isDev })
        .split("; ")
        .find((entry) => entry.startsWith(`${name} `));
    for (const isDev of [false, true]) {
      expect(directive("frame-src", isDev)).toBe("frame-src 'self' https://player.vdocipher.com");
    }
    expect(directive("connect-src")).toBe("connect-src 'self' https://*.amazonaws.com");
    // Nothing else of VdoCipher's but its player API's script (ticket 04), on
    // the player's own host, and no new style, image or font source.
    const csp = buildCsp(NONCE, { isDev: false });
    expect(csp.match(/vdocipher/g)).toHaveLength(2);
    expect(directive("script-src")).toBe(
      `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic' https://player.vdocipher.com`,
    );
    expect(directive("style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(directive("font-src")).toBe("font-src 'self' data:");
    expect(directive("default-src")).toBe("default-src 'self'");
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
