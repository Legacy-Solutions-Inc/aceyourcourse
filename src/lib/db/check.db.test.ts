import { readdirSync, readFileSync } from "node:fs";

import { drizzle } from "drizzle-orm/postgres-js";
import { beforeAll, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { loadTestCatalogue } from "../../../test/catalogue-database";

import {
  checkReport,
  configPostgresMajor,
  localMigrationVersions,
  readDatabaseFacts,
  readOnly,
  runDatabaseCheck,
} from "./check";
import { describeWithDatabase, openTestDatabase, rolledBack } from "./test-database";

// `pnpm db:check` against local Supabase (`pnpm test:db`): it reads the
// migrations applied, the deny-all status of every table, the bucket and the
// catalogue counts, all in a read-only transaction. The sad paths add a
// fixture in a transaction that is always rolled back.

const database = await openTestDatabase();

const LOCAL = {
  migrations: localMigrationVersions(readdirSync("supabase/migrations")),
  postgresMajor: configPostgresMajor(readFileSync("supabase/config.toml", "utf8")),
};

/** The command against the test database, with what it printed. */
async function checkCommand() {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runDatabaseCheck({
    databaseUrl: process.env.TEST_DATABASE_URL,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
  });
  return { code, out, err };
}

describeWithDatabase("db:check on the database", database, (db) => {
  beforeAll(async () => {
    await loadTestCatalogue(drizzle(db(), { schema }));
  });

  it("reports every migration applied, every table deny-all, the bucket and the counts, and exits 0", async () => {
    const { code, out, err } = await checkCommand();

    expect({ code, err }).toEqual({ code: 0, err: [] });
    expect(out[0]).toBe("Checking the local database (read-only):");
    expect(out).toContain(
      `✓ Migrations: all ${LOCAL.migrations.length} in supabase/migrations are applied`,
    );
    expect(out.some((line) => /^✓ Deny-all: \d+ tables in public/.test(line))).toBe(true);
    expect(out).toContain(
      '✓ Storage bucket "catalogue": public, 10 MB limit, image/jpeg, image/png, image/webp',
    );
    expect(out.at(-1)).toBe("All checks passed. Nothing was written.");
  });

  it("counts the loaded catalogue", async () => {
    const facts = await readOnly(db(), readDatabaseFacts);
    expect(facts.counts).toMatchObject({
      exams: CATALOGUE_SEED.exams.length,
      reviews: CATALOGUE_SEED.reviews.length,
      faqs: CATALOGUE_SEED.faqs.length,
      liveProducts: CATALOGUE_SEED.products.filter((p) => p.state === "live").length,
      websiteSettings: 1,
    });
  });

  it("reads in a read-only transaction: a write inside it is refused", async () => {
    await expect(
      readOnly(db(), (tx) => tx`create table public.db_check_probe (id int)`),
    ).rejects.toMatchObject({ code: "25006" });
    const [probe] = await db()`select to_regclass('public.db_check_probe') as name`;
    expect(probe?.name).toBeNull();
  });

  it("exits 1 and names the table when a table with RLS off is committed", async () => {
    // The command opens its own connection, so this fixture is committed,
    // then dropped.
    await db()`create table public.db_check_committed (id int primary key)`;
    try {
      const { code, out } = await checkCommand();
      expect(code).toBe(1);
      expect(out).toContain("✗ Deny-all: 1 problem");
      expect(out).toContain("    public.db_check_committed: RLS is off");
    } finally {
      await db()`drop table public.db_check_committed`;
    }
  });

  it("fails and names the table when a table has RLS off", async () => {
    const report = await rolledBack(db(), async (tx) => {
      await tx`create table public.db_check_open (id int primary key)`;
      return checkReport(await readDatabaseFacts(tx), LOCAL);
    });
    expect(report.ok).toBe(false);
    expect(report.lines).toContain("    public.db_check_open: RLS is off");
  });

  it("fails and names the table and policy when a policy lets anon in", async () => {
    const report = await rolledBack(db(), async (tx) => {
      await tx`create policy "db check reads" on public.products for select to anon using (true)`;
      return checkReport(await readDatabaseFacts(tx), LOCAL);
    });
    expect(report.ok).toBe(false);
    expect(report.lines).toContain('    public.products: policy "db check reads" for anon');
  });

  it("fails on a storage.objects policy for the browser roles", async () => {
    const report = await rolledBack(db(), async (tx) => {
      await tx`create policy "db check lists" on storage.objects for select to authenticated using (true)`;
      return checkReport(await readDatabaseFacts(tx), LOCAL);
    });
    expect(report.ok).toBe(false);
    expect(report.lines).toContain(
      '    storage.objects: policy "db check lists" for authenticated',
    );
  });

  it("fails when the bucket allows any size", async () => {
    const report = await rolledBack(db(), async (tx) => {
      await tx`update storage.buckets set file_size_limit = null where id = 'catalogue'`;
      return checkReport(await readDatabaseFacts(tx), LOCAL);
    });
    expect(report.ok).toBe(false);
    expect(report.lines.some((line) => line.startsWith('✗ Storage bucket "catalogue"'))).toBe(true);
  });
});
