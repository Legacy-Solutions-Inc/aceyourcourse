import type { Sql, TransactionSql } from "postgres";
import { expect, it } from "vitest";

import { describeWithDatabase, openTestDatabase } from "./test-database";

// Access is checked on the server (spec Phase 2; Testing Decisions: Permission
// and deny-all tests). Drizzle connects with full access and the Staff Guard
// decides; the browser roles must reach no table. So for every table in public:
// RLS is on, no policy lets `anon` or `authenticated` in, and neither role
// holds a grant. Tables added later are checked by the same query, so this
// keeps guarding them. Fixtures live in a rolled-back transaction.

const BROWSER_ROLES = ["anon", "authenticated"];

/** Every way a browser role could reach a relation in `schema`, one line per problem. */
async function denyAllViolations(sql: Sql | TransactionSql, schema: string): Promise<string[]> {
  const rlsOff = await sql<{ name: string }[]>`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relkind in ('r', 'p') and not c.relrowsecurity`;
  // A policy for `public` applies to every role, the browser roles included.
  const policies = await sql<{ name: string; policy: string; roles: string[] }[]>`
    select tablename as name, policyname as policy, roles::text[] as roles
    from pg_policies
    where schemaname = ${schema}
      and roles && array['public', 'anon', 'authenticated']::name[]`;
  // Table, view and sequence grants, and column grants. A grant to PUBLIC
  // (grantee 0) reaches the browser roles too.
  const grants = await sql<{ name: string; privilege: string; grantee: string }[]>`
    select c.relname as name, a.privilege_type as privilege,
           coalesce(r.rolname, 'PUBLIC') as grantee
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    left join pg_roles r on r.oid = a.grantee
    where n.nspname = ${schema} and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and (a.grantee = 0 or r.rolname in ${sql(BROWSER_ROLES)})
    union
    select c.relname || '.' || att.attname, a.privilege_type, coalesce(r.rolname, 'PUBLIC')
    from pg_attribute att
    join pg_class c on c.oid = att.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(att.attacl) a
    left join pg_roles r on r.oid = a.grantee
    where n.nspname = ${schema}
      and (a.grantee = 0 or r.rolname in ${sql(BROWSER_ROLES)})`;

  return [
    ...rlsOff.map(({ name }) => `${schema}.${name}: RLS is off`),
    ...policies.map(
      ({ name, policy, roles }) => `${schema}.${name}: policy "${policy}" for ${roles.join(", ")}`,
    ),
    ...grants.map(
      ({ name, privilege, grantee }) => `${schema}.${name}: ${privilege} granted to ${grantee}`,
    ),
  ].sort();
}

const FIXTURE_SCHEMA = "deny_all_fixture";

class RolledBack extends Error {}

/** Runs `body` in a transaction that is always rolled back, returning its result. */
async function rolledBack<T>(sql: Sql, body: (tx: TransactionSql) => Promise<T>): Promise<T> {
  let result: { value: T } | undefined;
  try {
    await sql.begin(async (tx) => {
      result = { value: await body(tx) };
      throw new RolledBack();
    });
  } catch (error) {
    if (!(error instanceof RolledBack)) throw error;
  }
  if (!result) throw new Error("The transaction body never finished.");
  return result.value;
}

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
