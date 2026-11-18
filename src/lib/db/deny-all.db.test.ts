import type { TransactionSql } from "postgres";
import { expect, it } from "vitest";

import { denyAllViolations } from "./check";
import { describeWithDatabase, openTestDatabase, rolledBack } from "./test-database";

// Access is checked on the server (spec Phase 2; Testing Decisions: Permission
// and deny-all tests). Drizzle connects with full access and the Staff Guard
// decides; the browser roles must reach no table. So for every table in public:
// RLS is on, no policy lets `anon` or `authenticated` in, and neither role
// holds a grant. Tables added later are checked by the same query, so this
// keeps guarding them, and `pnpm db:check` (check.ts) runs the same query
// against any database. Fixtures live in a rolled-back transaction.

const FIXTURE_SCHEMA = "deny_all_fixture";

/** A fixture schema holding one table that passes, so each case adds one problem. */
async function fixtureSchema(tx: TransactionSql) {
  await tx`create schema ${tx(FIXTURE_SCHEMA)}`;
  await tx`create table ${tx(FIXTURE_SCHEMA)}.locked (id int primary key)`;
  await tx`alter table ${tx(FIXTURE_SCHEMA)}.locked enable row level security`;
}

const database = await openTestDatabase();

describeWithDatabase("Deny-all: the browser roles reach no table", database, (db) => {
  it("finds no table in public that anon or authenticated can reach", async () => {
    expect(await denyAllViolations(db(), "public")).toEqual([]);
  });

  // The check above passes a table that isn't there, so the Member App's
  // tables (Phase 3) are named: each exists, with RLS on and no policy at all.
  it.each([
    "beta_testers",
    "members",
    "member_consents",
    "member_target_exams",
    "member_active_devices",
    "member_device_switches",
    "topics",
    "decks",
    "cards",
    "card_marks",
    "quizzes",
    "reviewer_pdfs",
    "access_passes",
    "access_pass_grants",
  ])("has the Member App's %s table, with RLS on and no policy", async (table) => {
    const [found] = await db()<{ rls: boolean; policies: number }[]>`
        select c.relrowsecurity as rls,
          (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = ${table} and c.relkind = 'r'`;
    expect(found).toEqual({ rls: true, policies: 0 });
  });

  it("gives a new table in public no grant for the browser roles (the revoke migration)", async () => {
    const violations = await rolledBack(db(), async (tx) => {
      await tx`create table public.deny_all_probe (id int primary key)`;
      await tx`alter table public.deny_all_probe enable row level security`;
      return denyAllViolations(tx, "public");
    });
    expect(violations).toEqual([]);
  });

  it("passes the fixture's locked table", async () => {
    const violations = await rolledBack(db(), async (tx) => {
      await fixtureSchema(tx);
      return denyAllViolations(tx, FIXTURE_SCHEMA);
    });
    expect(violations).toEqual([]);
  });

  it("fails on a table with RLS off, naming it", async () => {
    const violations = await rolledBack(db(), async (tx) => {
      await fixtureSchema(tx);
      await tx`create table ${tx(FIXTURE_SCHEMA)}.open_rows (id int primary key)`;
      return denyAllViolations(tx, FIXTURE_SCHEMA);
    });
    expect(violations).toEqual([`${FIXTURE_SCHEMA}.open_rows: RLS is off`]);
  });

  it("fails on a policy for anon, naming the table and policy", async () => {
    const violations = await rolledBack(db(), async (tx) => {
      await fixtureSchema(tx);
      await tx`create policy "anyone reads" on ${tx(FIXTURE_SCHEMA)}.locked
        for select to anon using (true)`;
      return denyAllViolations(tx, FIXTURE_SCHEMA);
    });
    expect(violations).toEqual([`${FIXTURE_SCHEMA}.locked: policy "anyone reads" for anon`]);
  });

  it("fails on a policy for public, which reaches the browser roles too", async () => {
    const violations = await rolledBack(db(), async (tx) => {
      await fixtureSchema(tx);
      await tx`create policy "everyone" on ${tx(FIXTURE_SCHEMA)}.locked using (true)`;
      return denyAllViolations(tx, FIXTURE_SCHEMA);
    });
    expect(violations).toEqual([`${FIXTURE_SCHEMA}.locked: policy "everyone" for public`]);
  });

  it("fails on a grant to authenticated, naming the table", async () => {
    const violations = await rolledBack(db(), async (tx) => {
      await fixtureSchema(tx);
      await tx`grant select on ${tx(FIXTURE_SCHEMA)}.locked to authenticated`;
      return denyAllViolations(tx, FIXTURE_SCHEMA);
    });
    expect(violations).toEqual([`${FIXTURE_SCHEMA}.locked: SELECT granted to authenticated`]);
  });

  it("fails on a column grant to anon, naming the column", async () => {
    const violations = await rolledBack(db(), async (tx) => {
      await fixtureSchema(tx);
      await tx`grant select (id) on ${tx(FIXTURE_SCHEMA)}.locked to anon`;
      return denyAllViolations(tx, FIXTURE_SCHEMA);
    });
    expect(violations).toEqual([`${FIXTURE_SCHEMA}.locked.id: SELECT granted to anon`]);
  });
});
