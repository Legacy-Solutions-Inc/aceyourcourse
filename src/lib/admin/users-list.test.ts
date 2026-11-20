import { describe, expect, it } from "vitest";

import { USER_FILTERS } from "@/services/admin.types";

import { parseUsersParams, userListHref } from "./users-list";

// The Users screen's URL (story 129): which tab, and the list's search,
// filter and page, so a reload or a shared link keeps them. Anything the
// screen doesn't know falls back to its default.

const DEFAULTS = { q: null, filter: "all", page: 1 } as const;

describe("parseUsersParams", () => {
  it("opens the Users list with no search, every Member and the first page by default", () => {
    expect(parseUsersParams({})).toEqual({ tab: "users", query: DEFAULTS });
  });

  it("opens the Beta Testers tab", () => {
    expect(parseUsersParams({ tab: "beta-testers" })).toMatchObject({ tab: "beta-testers" });
  });

  it("opens the Privacy Requests tab", () => {
    expect(parseUsersParams({ tab: "privacy-requests" })).toMatchObject({
      tab: "privacy-requests",
    });
  });

  it("opens the Users list for any other tab", () => {
    expect(parseUsersParams({ tab: "orders" })).toMatchObject({ tab: "users" });
  });

  it("reads the search, trimmed", () => {
    expect(parseUsersParams({ q: "  Bea  " }).query).toEqual({ ...DEFAULTS, q: "Bea" });
  });

  it("reads a blank search as none", () => {
    expect(parseUsersParams({ q: "   " }).query.q).toBeNull();
  });

  it("keeps the first 100 characters of a long search", () => {
    expect(parseUsersParams({ q: "a".repeat(150) }).query.q).toBe("a".repeat(100));
  });

  it("reads the first of a repeated parameter", () => {
    expect(parseUsersParams({ q: ["bea", "sam"], filter: ["beta", "staff"] }).query).toEqual({
      ...DEFAULTS,
      q: "bea",
      filter: "beta",
    });
  });

  it.each(USER_FILTERS)("reads the %s filter", (filter) => {
    expect(parseUsersParams({ filter }).query.filter).toBe(filter);
  });

  it("reads a filter whatever its case", () => {
    expect(parseUsersParams({ filter: "Active" }).query.filter).toBe("active");
  });

  it.each(["paid", "", "admins"])("falls back to every Member for the filter %j", (filter) => {
    expect(parseUsersParams({ filter }).query.filter).toBe("all");
  });

  it("reads the page", () => {
    expect(parseUsersParams({ page: "3" }).query.page).toBe(3);
  });

  it.each(["0", "-1", "abc", "2.5", "1e3", "", " 2", "9999999"])(
    "falls back to the first page for %j",
    (page) => {
      expect(parseUsersParams({ page }).query.page).toBe(1);
    },
  );
});

describe("userListHref", () => {
  it("is the bare Users address with the defaults", () => {
    expect(userListHref(DEFAULTS)).toBe("/admin/users");
  });

  it("carries the search, filter and page", () => {
    expect(userListHref({ q: "bea tester", filter: "beta", page: 2 })).toBe(
      "/admin/users?q=bea+tester&filter=beta&page=2",
    );
  });

  it("leaves out every Member and the first page", () => {
    expect(userListHref({ q: "bea", filter: "all", page: 1 })).toBe("/admin/users?q=bea");
  });

  it("is read back as the same query", () => {
    const query = { q: "a&b=c", filter: "expired", page: 4 } as const;
    const search = new URLSearchParams(userListHref(query).split("?")[1]);
    expect(parseUsersParams(Object.fromEntries(search)).query).toEqual(query);
  });
});
