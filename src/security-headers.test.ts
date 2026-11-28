// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// The static security headers every response carries (security review, Phase
// 5 ticket 05). next.config.ts sets them on every route; the per-request CSP
// is the middleware's (src/middleware.test.ts, src/lib/csp.test.ts). Pinned
// here, so a header taken away or loosened fails a test.

/** next.config.ts, as built for `nodeEnv`. */
async function nextConfigIn(nodeEnv: "development" | "production") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return (await import("../next.config")).default;
}

/** The headers next.config.ts gives every route, for a server built as `nodeEnv`. */
async function everyRouteHeaders(nodeEnv: "development" | "production") {
  const rules = (await (await nextConfigIn(nodeEnv)).headers?.()) ?? [];
  const everyRoute = rules.find(({ source }) => source === "/:path*");
  expect(everyRoute, "a header rule for every route").toBeDefined();
  return Object.fromEntries((everyRoute?.headers ?? []).map(({ key, value }) => [key, value]));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the security headers on every route", () => {
  it("refuses framing, sniffing, cross-origin openers and unused browser features", async () => {
    expect(await everyRouteHeaders("production")).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-site",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), autoplay=(self)",
    });
  });

  it("keeps browsers on https for two years in production", async () => {
    expect((await everyRouteHeaders("production"))["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });

  it("sends no HSTS under pnpm dev, which runs on plain http", async () => {
    expect(await everyRouteHeaders("development")).not.toHaveProperty("Strict-Transport-Security");
  });

  it("doesn't say what the site is built with", async () => {
    expect((await nextConfigIn("production")).poweredByHeader).toBe(false);
  });
});
