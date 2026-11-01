import { describe, expect, it } from "vitest";

import { adminMenu, adminScreen, isCurrentScreen } from "./admin-menu";

// The Admin's fixed menu (spec Phase 2, Menu): five screens in four groups,
// with Settings for Owners only. Nothing from a later phase appears.
describe("adminMenu", () => {
  const flat = (role: "owner" | "editor") =>
    adminMenu(role).flatMap((group) =>
      group.items.map((item) => [group.label, item.code, item.label, item.href]),
    );

  it("gives an Owner all five screens, numbered 01 to 05", () => {
    expect(flat("owner")).toEqual([
      ["HOME", "01", "Overview", "/admin"],
      ["WEBSITE", "02", "Exam pages & promo", "/admin/exam-pages"],
      ["WEBSITE", "03", "Products & store links", "/admin/products"],
      ["WEBSITE", "04", "Reviews & FAQs", "/admin/reviews"],
      ["SETTINGS", "05", "Settings", "/admin/settings"],
    ]);
  });

  it("leaves Settings, and its empty group, out of an Editor's menu", () => {
    expect(flat("editor")).toEqual([
      ["HOME", "01", "Overview", "/admin"],
      ["WEBSITE", "02", "Exam pages & promo", "/admin/exam-pages"],
      ["WEBSITE", "03", "Products & store links", "/admin/products"],
      ["WEBSITE", "04", "Reviews & FAQs", "/admin/reviews"],
    ]);
  });
});

describe("adminScreen", () => {
  it("gives each screen's group label and title for its header", () => {
    expect(adminScreen("overview")).toEqual({ group: "HOME", title: "Overview" });
    expect(adminScreen("products")).toEqual({ group: "WEBSITE", title: "Products & store links" });
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
