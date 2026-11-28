import { describe, expect, it } from "vitest";

import { adminMenu, adminScreen, isCurrentScreen } from "./admin-menu";

// The Admin's fixed menu (spec Phase 2, Menu): Phase 2's five screens, then
// Phase 3's Member App content (ticket 05) and Users (ticket 01), then Phase
// 4's SALES group with Plans & prices (ticket 01) and Orders & payments
// (ticket 07), and Phase 5's Courses & videos (ticket 01), with Users, the
// SALES group and Settings for Owners only.
// Nothing else from a later phase appears.
describe("adminMenu", () => {
  const flat = (role: "owner" | "editor") =>
    adminMenu(role).flatMap((group) =>
      group.items.map((item) => [group.label, item.code, item.label, item.href]),
    );

  it("gives an Owner all ten screens, numbered 01 to 10", () => {
    expect(flat("owner")).toEqual([
      ["HOME", "01", "Overview", "/admin"],
      ["WEBSITE", "02", "Pages & promo", "/admin/exam-pages"],
      ["WEBSITE", "03", "Products & store links", "/admin/products"],
      ["WEBSITE", "04", "Reviews & FAQs", "/admin/reviews"],
      ["MEMBER APP", "05", "Member App content", "/admin/content"],
      ["MEMBER APP", "06", "Courses & videos", "/admin/content/courses"],
      ["MEMBER APP", "07", "Users", "/admin/users"],
      ["SALES", "08", "Plans & prices", "/admin/plans"],
      ["SALES", "09", "Orders & payments", "/admin/orders"],
      ["SETTINGS", "10", "Settings", "/admin/settings"],
    ]);
  });

  it("leaves Users, Plans & prices, Orders & payments and Settings, and the empty SALES and SETTINGS groups, out of an Editor's menu", () => {
    expect(flat("editor")).toEqual([
      ["HOME", "01", "Overview", "/admin"],
      ["WEBSITE", "02", "Pages & promo", "/admin/exam-pages"],
      ["WEBSITE", "03", "Products & store links", "/admin/products"],
      ["WEBSITE", "04", "Reviews & FAQs", "/admin/reviews"],
      ["MEMBER APP", "05", "Member App content", "/admin/content"],
      ["MEMBER APP", "06", "Courses & videos", "/admin/content/courses"],
    ]);
  });
});

describe("adminScreen", () => {
  it("gives each screen's group label and title for its header", () => {
    expect(adminScreen("overview")).toEqual({ group: "HOME", title: "Overview" });
    expect(adminScreen("products")).toEqual({ group: "WEBSITE", title: "Products & store links" });
    expect(adminScreen("content")).toEqual({ group: "MEMBER APP", title: "Member App content" });
    expect(adminScreen("courses")).toEqual({ group: "MEMBER APP", title: "Courses & videos" });
    expect(adminScreen("users")).toEqual({ group: "MEMBER APP", title: "Users" });
    expect(adminScreen("plans")).toEqual({ group: "SALES", title: "Plans & prices" });
    expect(adminScreen("orders")).toEqual({ group: "SALES", title: "Orders & payments" });
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
    ["/admin/orders/AYC-10482", "/admin/orders", true],
  ])("on %s, %s is current: %s", (pathname, href, expected) => {
    expect(isCurrentScreen(pathname, href)).toBe(expected);
  });

  it("gives the closest match only, so Courses & videos isn't also Member App content", () => {
    const hrefs = ["/admin", "/admin/content", "/admin/content/courses"];
    expect(isCurrentScreen("/admin/content/courses", "/admin/content/courses", hrefs)).toBe(true);
    expect(isCurrentScreen("/admin/content/courses", "/admin/content", hrefs)).toBe(false);
    expect(isCurrentScreen("/admin/content/deck", "/admin/content", hrefs)).toBe(true);
  });
});
