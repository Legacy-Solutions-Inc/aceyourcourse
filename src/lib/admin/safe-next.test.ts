import { describe, expect, it } from "vitest";

import { safeAdminNext } from "./safe-next";

// Where sign-in sends Staff afterwards. `next` comes from the address bar, so
// anything but a plain Admin path falls back to the Overview: no other site, no
// other Surface, and no way back to the sign-in or 403 screens.
describe("safeAdminNext", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/", "/admin/"],
    ["/admin/products", "/admin/products"],
    ["/admin/products?product=new", "/admin/products?product=new"],
    ["/admin/reviews?tab=faqs&group=shipping", "/admin/reviews?tab=faqs&group=shipping"],
    ["/admin/products#photos", "/admin/products"],
  ])("keeps the Admin path %s", (next, expected) => {
    expect(safeAdminNext(next)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "https://evil.example/admin",
    "//evil.example",
    "//evil.example/admin",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "/app",
    "/",
    "/products",
    "/adminx",
    "/administrator",
    "admin",
    "/admin/../app",
    "/admin/%2e%2e/app",
    "/admin/sign-in",
    "/admin/sign-in?next=%2Fadmin",
    "/admin/denied?reason=not-staff",
  ])("falls back to the Overview for %s", (next) => {
    expect(safeAdminNext(next)).toBe("/admin");
  });

  it.each([undefined, null, "", ["/admin/products"], 42])(
    "falls back to the Overview for a missing or odd value: %j",
    (next) => {
      expect(safeAdminNext(next)).toBe("/admin");
    },
  );
});
