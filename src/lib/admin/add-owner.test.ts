// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { StaffRow } from "@/services/admin.rows";

import { type AddOwnerCommand, planOwner, runAddOwner } from "./add-owner";

// `pnpm staff:add-owner <email>` (ticket 16): the first Owner at deployment.
// The plan is pure: what the staff list's row for the email becomes, and the
// Staff Activity it records. The command's refusals need no database. The
// writes themselves are checked on a database in add-owner.db.test.ts.

const NOW = new Date("2026-11-04T09:00:00.000Z");
const EMAIL = "owner@example.com";
const DEPLOYMENT = { email: "deployment", name: "deployment" };

const row = (fields: Partial<StaffRow>): StaffRow => ({
  email: EMAIL,
  position: 0,
  status: "active",
  role: "editor",
  name: "Content Team",
  addedAt: new Date("2026-10-01T00:00:00.000Z"),
  lastSignedInAt: null,
  invitedAt: null,
  expiresAt: null,
  ...fields,
});

describe("planOwner", () => {
  it("adds a new email as an active Owner, named by its email until Google gives a name", () => {
    const plan = planOwner(undefined, EMAIL, NOW, 2);

    expect(plan.outcome).toBe("added");
    expect(plan.row).toEqual({
      email: EMAIL,
      position: 2,
      status: "active",
      role: "owner",
      name: EMAIL,
      addedAt: NOW,
      lastSignedInAt: null,
      invitedAt: null,
      expiresAt: null,
    });
    expect(plan.activity).toMatchObject({
      actor: DEPLOYMENT,
      at: NOW.toISOString(),
      entity: "staff",
      entityId: EMAIL,
      action: "add-owner",
      before: null,
      after: { email: EMAIL, name: EMAIL, role: "owner", addedAt: NOW.toISOString() },
    });
  });

  it("upgrades an active Editor to Owner, keeping their name and place", () => {
    const editor = row({ position: 1 });
    const plan = planOwner(editor, EMAIL, NOW, 3);

    expect(plan.outcome).toBe("upgraded-editor");
    expect(plan.row).toEqual({ ...editor, role: "owner" });
    expect(plan.activity).toMatchObject({
      actor: DEPLOYMENT,
      action: "change-role",
      before: { email: EMAIL, name: "Content Team", role: "editor" },
      after: { email: EMAIL, name: "Content Team", role: "owner" },
    });
  });

  it.each(["editor", "owner"] as const)(
    "turns an Invite (as %s), even an expired one, into an active Owner",
    (role) => {
      const invite = row({
        status: "invited",
        role,
        name: null,
        addedAt: null,
        position: 0,
        invitedAt: new Date("2026-10-01T00:00:00.000Z"),
        expiresAt: new Date("2026-10-08T00:00:00.000Z"),
      });
      const plan = planOwner(invite, EMAIL, NOW, 4);

      expect(plan.outcome).toBe("upgraded-invite");
      expect(plan.row).toEqual({
        email: EMAIL,
        position: 4,
        status: "active",
        role: "owner",
        name: EMAIL,
        addedAt: NOW,
        lastSignedInAt: null,
        invitedAt: null,
        expiresAt: null,
      });
      expect(plan.activity).toMatchObject({
        action: "add-owner",
        before: { email: EMAIL, role, expiresAt: "2026-10-08T00:00:00.000Z" },
        after: { email: EMAIL, role: "owner" },
      });
    },
  );

  it("changes nothing for an active Owner: running it again is safe", () => {
    const owner = row({ role: "owner" });
    expect(planOwner(owner, EMAIL, NOW, 3)).toEqual({
      outcome: "unchanged",
      row: owner,
      activity: null,
    });
  });
});

const SECRET = "s3cret-Passw0rd";
const HOSTED_NOWHERE = `postgresql://postgres.abc:${SECRET}@db.nowhere.invalid:5432/postgres`;

async function run(command: Partial<AddOwnerCommand>) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runAddOwner({
    args: [EMAIL],
    databaseUrl: HOSTED_NOWHERE,
    connectTimeoutSeconds: 2,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    ...command,
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("staff:add-owner: refusals", () => {
  it("exits 1 with the usage when no email is given", async () => {
    expect(await run({ args: [] })).toEqual({
      code: 1,
      out: "",
      err: "Usage: pnpm staff:add-owner <email>",
    });
  });

  it.each([["not-an-email"], ["owner@example.com", "extra"], ["--force"]])(
    "exits 1 on %j, before connecting",
    async (...args) => {
      const result = await run({ args, databaseUrl: undefined });
      expect(result.code).toBe(1);
      expect(result.err).toMatch(
        /^(Usage: pnpm staff:add-owner <email>|.+ isn't an email address\. Nothing was changed\.)$/,
      );
    },
  );

  it("names the typed value when it isn't an email address", async () => {
    expect((await run({ args: ["not-an-email"] })).err).toBe(
      '"not-an-email" isn\'t an email address. Nothing was changed.',
    );
  });

  it.each([undefined, ""])("exits 1 asking for DATABASE_URL when it is %j", async (databaseUrl) => {
    expect(await run({ databaseUrl })).toEqual({
      code: 1,
      out: "",
      err: "DATABASE_URL is not set. Set it to the database to add the Owner to. Nothing was changed.",
    });
  });

  it("exits 1 on a DATABASE_URL that isn't a URL, without printing it", async () => {
    const result = await run({ databaseUrl: `not a url ${SECRET}` });
    expect(result.code).toBe(1);
    expect(result.err).toBe("DATABASE_URL is not a valid connection string. Nothing was changed.");
  });

  it("exits 1 on an unreachable database with only the error's code, never the URL", async () => {
    const result = await run({});
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^Couldn't reach the database \([A-Z_]+\)\. Nothing was changed\.$/);
    for (const text of [result.out, result.err]) {
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("nowhere.invalid");
    }
  });
});
