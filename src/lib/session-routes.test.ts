import { describe, expect, it } from "vitest";

import { isAdminPath, needsSession } from "./session-routes";

// Only the signed-in and auth areas need a Supabase session. Website pages must
// never trigger a Supabase round trip, so the match is on whole path segments.
describe("needsSession", () => {
  it.each(["/app", "/app/", "/app/library", "/admin", "/admin/x", "/auth/callback"])(
    "is true for %s",
    (pathname) => {
      expect(needsSession(pathname)).toBe(true);
    },
  );

  it.each([
    "/",
    "/products",
    "/products/x",
    "/exams/ce",
    "/application",
    "/administrator",
    "/apple-icon",
    "/authors",
    // The template dashboard is gone, so it is just another (404) Website path.
    "/dashboard",
    "/dashboard/x",
    "/dashboards",
    "",
  ])("is false for %s", (pathname) => {
    expect(needsSession(pathname)).toBe(false);
  });
});

// The Admin's own area, which its sample mode signs in to without Supabase.
describe("isAdminPath", () => {
  it.each(["/admin", "/admin/", "/admin/sign-in", "/admin/products"])(
    "is true for %s",
    (pathname) => {
      expect(isAdminPath(pathname)).toBe(true);
    },
  );

  it.each(["/", "/administrator", "/admins", "/app", "/auth/callback", "/products/admin", ""])(
    "is false for %s",
    (pathname) => {
      expect(isAdminPath(pathname)).toBe(false);
    },
  );
});
