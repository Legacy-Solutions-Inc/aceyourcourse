import { describe, expect, it } from "vitest";

import { adminMenu, adminScreen, isCurrentScreen } from "./admin-menu";

// The Admin's fixed menu (spec Phase 2, Menu): Phase 2's five screens, then
// Phase 3's Member App content (ticket 05) and Users (ticket 01), with Users
// and Settings for Owners only. Nothing else from a later phase appears.
describe("adminMenu", () => {
  const flat = (role: "owner" | "editor") =>
    adminMenu(role).flatMap((group) =>
      group.items.map((item) => [group.label, item.code, item.label, item.href]),
    );

  it("gives an Owner all seven screens, numbered 01 to 07", () => {
    expect(flat("owner")).toEqual([
      ["HOME", "01", "Overview", "/admin"],
      ["WEBSITE", "02", "Pages & promo", "/admin/exam-pages"],
      ["WEBSITE", "03", "Products & store links", "/admin/products"],
      ["WEBSITE", "04", "Reviews & FAQs", "/admin/reviews"],
      ["MEMBER APP", "05", "Member App content", "/admin/content"],
      ["MEMBER APP", "06", "Users", "/admin/users"],
      ["SETTINGS", "07", "Settings", "/admin/settings"],
    ]);
  });

  it("leaves Users and Settings, and the empty Settings group, out of an Editor's menu", () => {
    expect(flat("editor")).toEqual([
      ["HOME", "01", "Overview", "/admin"],
      ["WEBSITE", "02", "Pages & promo", "/admin/exam-pages"],
      ["WEBSITE", "03", "Products & store links", "/admin/products"],
      ["WEBSITE", "04", "Reviews & FAQs", "/admin/reviews"],
      ["MEMBER APP", "05", "Member App content", "/admin/content"],
    ]);
  });
});

describe("adminScreen", () => {
  it("gives each screen's group label and title for its header", () => {
    expect(adminScreen("overview")).toEqual({ group: "HOME", title: "Overview" });
    expect(adminScreen("products")).toEqual({ group: "WEBSITE", title: "Products & store links" });
    expect(adminScreen("content")).toEqual({ group: "MEMBER APP", title: "Member App content" });
    expect(adminScreen("users")).toEqual({ group: "MEMBER APP", title: "Users" });
    expect(adminScreen("settings")).toEqual({ group: "SETTINGS", title: "Settings" });
  });
});

describe("isCurrentScreen", () => {
  it.each([
    ["/admin", "/admin", true],
    ["/admin/products", "/admin", false],
    ["/admin/products", "/admin/products", true],
    ["/admin/products/x", "/admin/products", true],
    ["/admin/products-old", "/admin/products", false],
    ["/admin/reviews", "/admin/products", false],
  ])("on %s, %s is current: %s", (pathname, href, expected) => {
    expect(isCurrentScreen(pathname, href)).toBe(expected);
  });
});
