import { describe, expect, it } from "vitest";

import {
  activityActorLabel,
  activityAreaOf,
  activityAreaOptions,
  activityChanges,
  activityHref,
  entitiesOfArea,
  parseActivityParams,
  PAYMONGO_SYSTEM_NAME,
} from "./staff-activity-view";

describe("activityAreaOf", () => {
  it.each([
    ["product", "products", "Products"],
    ["exam-page", "exam-pages", "Exam pages"],
    ["exam", "exam-pages", "Exam pages"],
    ["member", "users", "Users"],
    ["access-pass", "users", "Users"],
    // A Course bought, given, removed or refunded is about a Member (Phase 5, ticket 07).
    ["course-ownership", "users", "Users"],
    ["plan", "plans", "Plans"],
    ["order", "orders", "Orders"],
    ["orders", "orders", "Orders"],
    ["staff", "staff", "Admin accounts"],
    ["invite", "staff", "Admin accounts"],
    ["reviewer-pdf", "content", "Member App content"],
    ["course", "courses", "Courses"],
    ["course-module", "courses", "Courses"],
    ["lesson", "courses", "Courses"],
  ])("puts the entity %j in the area %j, %j", (entity, key, label) => {
    expect(activityAreaOf(entity)).toEqual({ key, label });
  });

  it("falls back to the raw entity for one it doesn't know", () => {
    expect(activityAreaOf("coupon")).toEqual({ key: "coupon", label: "coupon" });
  });
});

describe("entitiesOfArea", () => {
  it("gives every entity a known area covers", () => {
    expect(entitiesOfArea("orders")).toEqual(["order", "orders"]);
    expect(entitiesOfArea("staff")).toEqual(["staff", "invite"]);
    expect(entitiesOfArea("courses")).toEqual(["course", "course-module", "lesson"]);
  });

  it("treats an unknown area as the raw entity of that name", () => {
    expect(entitiesOfArea("coupon")).toEqual(["coupon"]);
  });
});

describe("activityAreaOptions", () => {
  it("gives each area once, from the entities recorded, by label", () => {
    expect(activityAreaOptions(["plan", "order", "orders", "coupon", "product"])).toEqual([
      { key: "coupon", label: "coupon" },
      { key: "orders", label: "Orders" },
      { key: "plans", label: "Plans" },
      { key: "products", label: "Products" },
    ]);
  });

  it("is empty when nothing is recorded", () => {
    expect(activityAreaOptions([])).toEqual([]);
  });
});

describe("activityActorLabel", () => {
  it("shows a Staff User's name and email as recorded", () => {
    expect(activityActorLabel({ email: "kim@example.com", name: "Kim Reyes" })).toEqual({
      name: "Kim Reyes",
      email: "kim@example.com",
    });
  });

  it("shows the system actor as PayMongo (system), with no email", () => {
    expect(activityActorLabel({ email: "system:paymongo", name: "anything" })).toEqual({
      name: "PayMongo (system)",
      email: null,
    });
    expect(PAYMONGO_SYSTEM_NAME).toBe("PayMongo (system)");
  });

  it("falls back to the email when no name was recorded", () => {
    expect(activityActorLabel({ email: "kim@example.com", name: "" })).toEqual({
      name: "kim@example.com",
      email: "kim@example.com",
    });
  });
});

describe("activityChanges", () => {
  it("lists the fields added, removed and changed, and none that stayed the same", () => {
    expect(
      activityChanges(
        { name: "CE All-Access", price: 499, onSale: true, note: "x" },
        { name: "CE All-Access", price: 599, onSale: false, bestValue: true },
      ),
    ).toEqual({ added: ["bestValue"], removed: ["note"], changed: ["price", "onSale"] });
  });

  it("compares nested values by value, whatever the key order", () => {
    expect(
      activityChanges(
        { links: { a: 1, b: [1, 2] }, tags: ["x"] },
        { links: { b: [1, 2], a: 1 }, tags: ["y"] },
      ),
    ).toEqual({ added: [], removed: [], changed: ["tags"] });
  });

  it("gives every field as added for a record created, and removed for one deleted", () => {
    expect(activityChanges(null, { email: "a@b.c", role: "editor" })).toEqual({
      added: ["email", "role"],
      removed: [],
      changed: [],
    });
    expect(activityChanges({ email: "a@b.c" }, null)).toEqual({
      added: [],
      removed: ["email"],
      changed: [],
    });
  });

  it("treats a value that isn't a record as one field, `value`", () => {
    expect(activityChanges("old", "new")).toEqual({ added: [], removed: [], changed: ["value"] });
    expect(activityChanges([1], [1])).toEqual({ added: [], removed: [], changed: [] });
    expect(activityChanges(undefined, null)).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe("parseActivityParams and activityHref", () => {
  it("reads the Staff member, the area and the cursor", () => {
    expect(
      parseActivityParams({ actor: " kim@example.com ", area: "plans", before: "120" }),
    ).toEqual({ actor: "kim@example.com", area: "plans", before: 120 });
  });

  it("gives the first page, unfiltered, for empty params", () => {
    expect(parseActivityParams({})).toEqual({ actor: null, area: null, before: null });
    expect(parseActivityParams({ actor: "  ", area: "" })).toEqual({
      actor: null,
      area: null,
      before: null,
    });
  });

  it.each(["abc", "-3", "0", "1.5", "1e3", "99999999999999999999", "12abc"])(
    "reads a tampered cursor %j as the first page",
    (before) => {
      expect(parseActivityParams({ before }).before).toBeNull();
    },
  );

  it("takes the first of repeated params, and caps their length", () => {
    expect(parseActivityParams({ area: ["plans", "orders"] }).area).toBe("plans");
    expect(parseActivityParams({ actor: "x".repeat(500) }).actor).toHaveLength(320);
  });

  it("writes the params back, leaving out what's empty", () => {
    expect(activityHref({ actor: null, area: null, before: null })).toBe(
      "/admin/settings/activity",
    );
    expect(activityHref({ actor: "system:paymongo", area: "orders", before: 51 })).toBe(
      "/admin/settings/activity?actor=system%3Apaymongo&area=orders&before=51",
    );
  });

  it("reads back what it writes", () => {
    const query = { actor: "kim+ayc@example.com", area: "exam-pages", before: 7 };
    const search = new URL(activityHref(query), "http://x").searchParams;
    expect(parseActivityParams(Object.fromEntries(search))).toEqual(query);
  });
});
