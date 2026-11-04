import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import { describeWithDatabase, openTestDatabase } from "@/lib/db/test-database";

import { loadTestCatalogue } from "../../../test/catalogue-database";

import { runAddOwner } from "./add-owner";

// `pnpm staff:add-owner` against local Supabase (`pnpm test:db`; CI runs it).
// Each test starts from the sample staff list: two Staff and two Invites.
// Skips without TEST_DATABASE_URL.

const database = await openTestDatabase();

const NEW_OWNER = "first.owner@example.com";
const EDITOR = "content@aceyourcourse.ph";
const KIM = "kim.reyes@gmail.com";

describeWithDatabase("staff:add-owner, on the database", database, (sql) => {
  const db = () => drizzle(sql(), { schema });
  const staffRow = async (email: string) =>
    (await db().select().from(schema.staff).where(eq(schema.staff.email, email)))[0];
  const activity = () => db().select().from(schema.staffActivity).orderBy(schema.staffActivity.seq);

  async function addOwner(email: string) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runAddOwner({
      args: [email],
      databaseUrl: process.env.TEST_DATABASE_URL,
      log: (line) => out.push(line),
      error: (line) => err.push(line),
    });
    return { code, out, err };
  }

  beforeEach(async () => {
    await loadTestCatalogue(db());
    await db().delete(schema.staffActivity);
  });

  afterAll(async () => {
    await loadTestCatalogue(db());
  });

  it("adds a new email as an active Owner, recorded with the actor deployment", async () => {
    const result = await addOwner("  First.Owner@Example.com ");

    expect(result).toEqual({
      code: 0,
      out: [
        "On the local database:",
        `✓ Added ${NEW_OWNER} as an Owner.`,
        "  Staff: 2 Owners, 1 Editor, 2 Invites",
      ],
      err: [],
    });
    expect(await staffRow(NEW_OWNER)).toMatchObject({
      status: "active",
      role: "owner",
      name: NEW_OWNER,
    });
    expect(await activity()).toMatchObject([
      {
        actorEmail: "deployment",
        actorName: "deployment",
        entity: "staff",
        entityId: NEW_OWNER,
        action: "add-owner",
      },
    ]);
  });

  it("upgrades the Editor, and an Invite, to Owner", async () => {
    expect((await addOwner(EDITOR)).out[1]).toBe(`✓ ${EDITOR} was an Editor, and is an Owner now.`);
    expect(await staffRow(EDITOR)).toMatchObject({ status: "active", role: "owner" });

    expect((await addOwner(KIM)).out).toEqual([
      "On the local database:",
      `✓ ${KIM} had an Invite, and is an Owner now.`,
      "  Staff: 3 Owners, 0 Editors, 1 Invite",
    ]);
    expect(await staffRow(KIM)).toMatchObject({ status: "active", role: "owner", name: KIM });
    expect((await activity()).map(({ action }) => action)).toEqual(["change-role", "add-owner"]);
  });

  it("changes nothing when run again", async () => {
    await addOwner(NEW_OWNER);
    const before = await db().select().from(schema.staff);

    const again = await addOwner(NEW_OWNER);

    expect(again.code).toBe(0);
    expect(again.out[1]).toBe(`✓ ${NEW_OWNER} is an Owner already. Nothing was changed.`);
    expect(await db().select().from(schema.staff)).toEqual(before);
    expect(await activity()).toHaveLength(1);
  });
});
