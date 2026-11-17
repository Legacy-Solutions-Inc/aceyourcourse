import { describe, expect, it } from "vitest";

import { memberAppNext, safeMemberAppNext } from "./safe-next";

// Where sign-in sends a Member afterwards. `next` comes from the address bar,
// so anything but a plain Member App path falls back to Home: no other site,
// no other Surface, and no way back to the sign-in or "Not open yet" screens.
describe("safeMemberAppNext", () => {
  it.each([
    ["/app", "/app"],
    ["/app/", "/app/"],
    ["/app/library", "/app/library"],
    ["/app/library?topic=simple-curves", "/app/library?topic=simple-curves"],
    ["/app/plans#ce", "/app/plans"],
  ])("keeps the Member App path %s", (next, expected) => {
    expect(safeMemberAppNext(next)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "https://evil.example/app",
    "//x",
    "//evil.example/app",
    "/\\x",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "/admin",
    "/admin/products",
    "/",
    "/products",
    "/application",
    "/apple-icon",
    "app",
    "/app/../admin",
    "/app/%2e%2e/admin",
    "/app/..",
    "/app/sign-in",
    "/app/sign-in?next=%2Fapp",
    "/app/not-open-yet",
  ])("falls back to Home for %s", (next) => {
    expect(safeMemberAppNext(next)).toBe("/app");
  });

  it.each([undefined, null, "", ["/app/library"], 42])(
    "falls back to Home for a missing or odd value: %j",
    (next) => {
      expect(safeMemberAppNext(next)).toBe("/app");
    },
  );
});

// The OAuth callback serves both Surfaces, so it first asks which one `next`
// names: only a path inside the Member App is the Member App's.
describe("memberAppNext", () => {
  it.each([
    ["/app", "/app"],
    ["/app/library?topic=x", "/app/library?topic=x"],
    ["/app/sign-in", "/app"],
    ["/app/not-open-yet", "/app"],
  ])("answers %s with %s", (next, expected) => {
    expect(memberAppNext(next)).toBe(expected);
  });

  it.each([
    "/admin",
    "/admin/products",
    "/admin/../app",
    "/admin/%2e%2e/app",
    "/application",
    "//x/app",
    "/app/../admin",
    "",
    null,
  ])("says %j isn't the Member App's", (next) => {
    expect(memberAppNext(next)).toBeNull();
  });
});
