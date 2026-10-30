import { describe, expect, it } from "vitest";

import { needsSession } from "./session-routes";

// Only the signed-in and auth areas need a Supabase session. Website pages must
// never trigger a Supabase round trip, so the match is on whole path segments.
describe("needsSession", () => {
  it.each([
    "/app",
    "/app/",
    "/app/library",
    "/admin",
    "/admin/x",
    "/auth/callback",
    "/auth/sign-in",
    "/dashboard",
    "/dashboard/x",
  ])("is true for %s", (pathname) => {
    expect(needsSession(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/products",
    "/products/x",
    "/exams/ce",
    "/application",
    "/administrator",
    "/apple-icon",
    "/authors",
    "/dashboards",
    "",
  ])("is false for %s", (pathname) => {
    expect(needsSession(pathname)).toBe(false);
  });
});
