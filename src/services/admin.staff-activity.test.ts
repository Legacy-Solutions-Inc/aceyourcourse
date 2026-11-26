import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import type { StaffActivity, StaffActivityList, StaffActivityQuery } from "@/services/admin.types";
import { samplePlanId } from "@/services/mock/plans";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// The Staff Activity list for Owners (Phase 4, ticket 15; spec, Phase 4 →
// Orders Admin; Testing Decisions → Phase 4 seams), run against every arm.
// It's read-only: newest first, 50 to a page, paged by a cursor (the last
// record's seq) so records added while an Owner pages are never repeated or
// skipped; filtered by who made a record (removed Staff and PayMongo's system
// actor too) and by area; with every actor and entity recorded, for the
// filters. An Editor is refused all of it, since the values can hold personal
// data.

const BOOT = new Date("2026-11-25T02:00:00.000Z");
const MINUTE = 60_000;

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");
/** A Staff User since removed from the staff list: their records keep their name. */
const FORMER = { email: "former.editor@example.com", name: "Former Editor" };

const FIRST_PAGE: StaffActivityQuery = { actor: null, area: null, before: null };

let made = 0;
/** A fixture record, a minute after the one before. */
function record(
  actor: { email: string; name: string },
  entity: string,
  fields: Partial<StaffActivity> = {},
): StaffActivity {
  made += 1;
  return {
    id: `00000000-0000-4000-8000-${String(made).padStart(12, "0")}`,
    at: new Date(BOOT.getTime() + made * MINUTE).toISOString(),
    actor: { ...actor },
    entity,
    entityId: `${entity}-${made}`,
    action: "update",
    before: { n: made - 1 },
    after: { n: made },
    ...fields,
  };
}

/** Each record's entity id, the list's order kept. */
const idsOf = (list: StaffActivityList) => list.entries.map(({ entityId }) => entityId);

describe.each(ADMIN_ARMS)("Admin seam: Staff Activity list ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    made = 0;
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The list as an Owner reads it, which must not be refused. */
  async function list(query: Partial<StaffActivityQuery> = {}): Promise<StaffActivityList> {
    const listed = await seam.listStaffActivity(OWNER, { ...FIRST_PAGE, ...query });
    if (!listed.ok) throw new Error(`Refused: ${listed.error.kind}`);
    return listed.value;
  }

  it("is empty before anything is recorded", async () => {
    expect(await list()).toEqual({
      query: FIRST_PAGE,
      entries: [],
      next: null,
      actors: [],
      entities: [],
    });
  });

  it("gives an Admin write's record, as it was recorded, at the top", async () => {
    await arm.putStaffActivity([record(FORMER, "product")]);
    vi.setSystemTime(new Date(BOOT.getTime() + 60 * MINUTE));
    const saved = await seam.setPlanOnSale(OWNER, samplePlanId("CE", 30), false);
    expect(saved.ok).toBe(true);

    const { entries } = await list();
    expect(entries).toHaveLength(2);
    const [top, older] = entries;
    const [recorded] = (await arm.staffActivity()).slice(-1);
    expect(top).toEqual({ ...recorded, seq: expect.any(Number) });
    expect(top).toMatchObject({
      actor: { email: OWNER.email, name: OWNER.name },
      entity: "plan",
      at: new Date(BOOT.getTime() + 60 * MINUTE).toISOString(),
    });
    expect(top?.seq).toBeGreaterThan(older?.seq ?? Infinity);
  });

  it("lists newest first, by the order recorded", async () => {
    await arm.putStaffActivity([
      record(OWNER, "product"),
      record(EDITOR, "review"),
      record(OWNER, "faq"),
    ]);
    expect(idsOf(await list())).toEqual(["faq-3", "review-2", "product-1"]);
  });

  it("gives every actor once, with their latest name, and every entity, for the filters", async () => {
    await arm.putStaffActivity([
      record({ email: OWNER.email, name: "Angel (old name)" }, "product"),
      record(FORMER, "review"),
      record(PAYMONGO_SYSTEM_ACTOR, "order"),
      record(OWNER, "product"),
      record(PAYMONGO_SYSTEM_ACTOR, "access-pass"),
    ]);
    const { actors, entities } = await list();
    expect(actors).toEqual([
      { email: OWNER.email, name: OWNER.name },
      { email: FORMER.email, name: FORMER.name },
      { email: PAYMONGO_SYSTEM_ACTOR.email, name: PAYMONGO_SYSTEM_ACTOR.name },
    ]);
    expect(entities).toEqual(["access-pass", "order", "product", "review"]);
  });

  describe("filters", () => {
    beforeEach(async () => {
      await arm.putStaffActivity([
        record(OWNER, "plan"),
        record(FORMER, "product"),
        record(PAYMONGO_SYSTEM_ACTOR, "order", { action: "paid" }),
        record(OWNER, "orders", { action: "export-csv" }),
        record(PAYMONGO_SYSTEM_ACTOR, "access-pass", { action: "extend" }),
        record(EDITOR, "product"),
      ]);
    });

    it("by a Staff member, removed ones too", async () => {
      expect(idsOf(await list({ actor: OWNER.email }))).toEqual(["orders-4", "plan-1"]);
      expect(idsOf(await list({ actor: FORMER.email }))).toEqual(["product-2"]);
    });

    it("by PayMongo's system actor", async () => {
      expect(idsOf(await list({ actor: PAYMONGO_SYSTEM_ACTOR.email }))).toEqual([
        "access-pass-5",
        "order-3",
      ]);
    });

    it("by area: every entity the area covers, and only those", async () => {
      expect(idsOf(await list({ area: "orders" }))).toEqual(["orders-4", "order-3"]);
      expect(idsOf(await list({ area: "products" }))).toEqual(["product-6", "product-2"]);
      expect(idsOf(await list({ area: "users" }))).toEqual(["access-pass-5"]);
    });

    it("by both at once", async () => {
      expect(idsOf(await list({ actor: OWNER.email, area: "orders" }))).toEqual(["orders-4"]);
    });

    it("gives an empty page, with the filters' options, for a filter nothing matches", async () => {
      const empty = await list({ actor: "nobody@example.com" });
      expect(empty.entries).toEqual([]);
      expect(empty.next).toBeNull();
      expect(empty.actors).toHaveLength(4);
      expect(idsOf(await list({ area: "faqs" }))).toEqual([]);
      expect(idsOf(await list({ area: "no such area" }))).toEqual([]);
    });

    it("keeps the filters on the list it gives back", async () => {
      const query = { actor: OWNER.email, area: "orders", before: null };
      expect((await list(query)).query).toEqual(query);
    });
  });

  describe("paging", () => {
    const TOTAL = 120;

    beforeEach(async () => {
      await arm.putStaffActivity(
        Array.from({ length: TOTAL }, (_, index) =>
          record(index % 2 === 0 ? OWNER : EDITOR, index % 3 === 0 ? "plan" : "product"),
        ),
      );
    });

    it("gives 50 to a page, newest first, then the older ones by the cursor", async () => {
      const first = await list();
      expect(first.entries).toHaveLength(50);
      expect(first.entries[0]?.entityId).toMatch(/-120$/);
      expect(first.next).toBe(first.entries[49]?.seq);

      const second = await list({ before: first.next });
      expect(second.entries).toHaveLength(50);
      expect(second.entries[0]?.entityId).toMatch(/-70$/);

      const last = await list({ before: second.next });
      expect(last.entries).toHaveLength(20);
      expect(last.entries.at(-1)?.entityId).toMatch(/-1$/);
      expect(last.next).toBeNull();
    });

    it("never repeats or skips a record when new ones arrive between pages", async () => {
      const seen: string[] = [];
      let query: Partial<StaffActivityQuery> = {};
      for (let page = 0; page < 10; page += 1) {
        const { entries, next } = await list(query);
        seen.push(...entries.map(({ entityId }) => entityId));
        // Someone saves while the Owner reads the page.
        await arm.putStaffActivity([record(OWNER, "faq"), record(PAYMONGO_SYSTEM_ACTOR, "order")]);
        if (next === null) break;
        query = { before: next };
      }
      expect(seen).toHaveLength(TOTAL);
      expect(new Set(seen).size).toBe(TOTAL);
      expect(seen.every((id) => /^(plan|product)-/.test(id))).toBe(true);
    });

    it("pages a filtered list the same way", async () => {
      const first = await list({ actor: EDITOR.email });
      expect(first.entries).toHaveLength(50);
      expect(first.next).not.toBeNull();
      const second = await list({ actor: EDITOR.email, before: first.next });
      expect(second.entries).toHaveLength(10);
      expect(second.next).toBeNull();
      const all = [...first.entries, ...second.entries];
      expect(all.every(({ actor }) => actor.email === EDITOR.email)).toBe(true);
      expect(new Set(all.map(({ id }) => id)).size).toBe(60);
    });

    it("gives the newest page for a cursor past the newest record, and none before the first", async () => {
      expect((await list({ before: Number.MAX_SAFE_INTEGER })).entries[0]?.entityId).toMatch(
        /-120$/,
      );
      const beforeAll = await list({ before: 1 });
      expect(beforeAll.entries).toEqual([]);
      expect(beforeAll.next).toBeNull();
    });
  });

  it("refuses an Editor, giving none of the records", async () => {
    await arm.putStaffActivity([record(OWNER, "plan")]);
    const listed = await seam.listStaffActivity(EDITOR, FIRST_PAGE);
    expect(listed).toEqual({
      ok: false,
      error: { kind: "forbidden", message: "ONLY AN OWNER CAN SEE STAFF ACTIVITY" },
    });
  });

  it("records nothing itself, and the seam has no way to change a record", async () => {
    await arm.putStaffActivity([record(OWNER, "plan")]);
    const before = await arm.staffActivity();
    await list();
    await seam.listStaffActivity(EDITOR, FIRST_PAGE);
    expect(await arm.staffActivity()).toEqual(before);
    expect(Object.keys(seam).filter((name) => /activity/i.test(name))).toEqual([
      "listStaffActivity",
    ]);
  });
});
