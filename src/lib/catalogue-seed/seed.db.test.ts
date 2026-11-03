import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterEach, expect, it } from "vitest";

import { describeWithDatabase, openTestDatabase } from "@/lib/db/test-database";
import type { Database } from "@/lib/db/connect";
import * as schema from "@/lib/db/schema";
import { staffFromRows } from "@/services/admin.rows";
import { readCatalogue } from "@/services/catalogue.db";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { sampleStaff } from "@/services/mock/staff";

import { loadTestCatalogue } from "../../../test/catalogue-database";
import { runCatalogueSeed, type SeedCommand } from "./cli";
import {
  clearCatalogue,
  formatSampleStaff,
  formatSeedCounts,
  planCatalogueSeed,
  seedCatalogue,
  seedCounts,
} from "./seed";

// `pnpm catalogue:seed` against local Supabase (`pnpm test:db`): it writes the
// whole seed in one transaction, replaces a local catalogue, and with
// --production refuses a database that already has catalogue data, changing
// nothing. Skips, saying why, without TEST_DATABASE_URL.

const database = await openTestDatabase();
const testDb: Database | undefined = database.sql ? drizzle(database.sql, { schema }) : undefined;

function db(): Database {
  if (!testDb) throw new Error("No test database: this suite should have been skipped.");
  return testDb;
}

const ALL_PARTS = ["exams", "settings", "products", "reviews", "faqs", "examPages"] as const;
const MARKER = "marker@example.test";

/** The catalogue in the test database, as the seed holds it. */
const catalogue = () => readCatalogue(db(), ALL_PARTS);

/** Marks the loaded catalogue, to tell whether anything replaced it. */
async function mark() {
  await db().update(schema.websiteSettings).set({ contactEmail: MARKER });
}
const contactEmail = async () => (await catalogue()).settings.contactEmail;

/** The staff list in the test database. */
const staffList = async () => staffFromRows(await db().select().from(schema.staff));

/** The command against the test database, with what it printed. */
async function seedCommand(command: Partial<SeedCommand>) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCatalogueSeed({
    args: [],
    databaseUrl: process.env.TEST_DATABASE_URL,
    supabaseUrl: undefined,
    secretKey: undefined,
    // The photos stay in public/ here; seed-photos.db.test.ts loads them into Storage.
    photos: null,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    ...command,
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describeWithDatabase("catalogue seed on the database", database, () => {
  afterEach(async () => {
    await loadTestCatalogue(db());
  });

  it("loads the whole seed and reports what it wrote", async () => {
    await clearCatalogue(db());
    const result = await seedCommand({});

    expect(result.code).toBe(0);
    expect(result.out.split("\n")).toEqual([
      "Loaded the catalogue into the local database:",
      ...formatSeedCounts(seedCounts(CATALOGUE_SEED)).map((line) => `  ${line}`),
      `  ${formatSampleStaff({ staff: 2, invites: 2 })}`,
    ]);
    expect(result.out).toContain("15 Products (8 Live, 7 Coming Soon)");
    expect(await catalogue()).toEqual(CATALOGUE_SEED);
  });

  it("adds the sample Staff locally, timed from the load, replacing the Admin's data", async () => {
    const now = new Date("2026-11-03T02:00:00.000Z");
    await db().insert(schema.staff).values({
      email: "someone@example.test",
      position: 9,
      status: "active",
      role: "owner",
      name: "Someone",
      addedAt: now,
    });
    await db()
      .insert(schema.recordStamps)
      .values({ record: "settings", updatedAt: now, updatedBy: "Someone" });

    expect(await seedCatalogue(db(), CATALOGUE_SEED, { now })).toMatchObject({
      ok: true,
      sampleStaff: { staff: 2, invites: 2 },
    });
    expect(await staffList()).toEqual(sampleStaff(now));
    expect(await db().select().from(schema.recordStamps)).toEqual([
      { record: "seeded", updatedAt: now, updatedBy: null },
    ]);
  });

  it("replaces a local catalogue that is already there", async () => {
    await mark();
    expect(await seedCatalogue(db(), CATALOGUE_SEED)).toMatchObject({ ok: true });
    expect(await catalogue()).toEqual(CATALOGUE_SEED);
  });

  it("refuses an invalid seed and changes nothing", async () => {
    await mark();
    const seed = structuredClone(CATALOGUE_SEED);
    const soon = seed.products.find((p) => p.state === "coming-soon");
    if (!soon) throw new Error("the seed has no Coming Soon Product");
    soon.priceFrom = 50000;

    expect(await seedCatalogue(db(), seed)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await contactEmail()).toBe(MARKER);
  });

  it("writes in one transaction: a seed the database refuses part-way leaves the catalogue as it was", async () => {
    await mark();
    // A valid seed passes every key, so a trigger on the FAQs, which are
    // written after the Exams, Products and Reviews, refuses part-way.
    await db().execute(sql`
      create function catalogue_seed_test_refuse() returns trigger language plpgsql
      as $$ begin raise exception 'refused by the test'; end $$`);
    await db().execute(sql`
      create trigger catalogue_seed_test_refuse before insert on faqs
      for each statement execute function catalogue_seed_test_refuse()`);
    try {
      await expect(seedCatalogue(db(), CATALOGUE_SEED)).rejects.toThrow();
    } finally {
      await db().execute(sql`drop trigger catalogue_seed_test_refuse on faqs`);
      await db().execute(sql`drop function catalogue_seed_test_refuse()`);
    }
    expect(await contactEmail()).toBe(MARKER);
    expect((await catalogue()).products).toHaveLength(CATALOGUE_SEED.products.length);
  });

  it("with --production, refuses a database that already has a Product, writes nothing and exits 1", async () => {
    await mark();
    const result = await seedCommand({ args: ["--production"] });

    expect(result.code).toBe(1);
    expect(result.err).toBe(
      "The database already has catalogue data. --production only loads an empty catalogue, and never deletes. Nothing was written.",
    );
    expect(await contactEmail()).toBe(MARKER);
  });

  it("with --production, refuses even when only one Catalogue row is left", async () => {
    await clearCatalogue(db());
    const [exam] = CATALOGUE_SEED.exams;
    if (!exam) throw new Error("the seed has no Exams");
    const { subjects: _subjects, ...fields } = exam;
    await db()
      .insert(schema.exams)
      .values({ ...fields, position: 0 });

    const result = await seedCommand({ args: ["--production"] });
    expect(result.code).toBe(1);
    expect((await db().select().from(schema.exams)).map((row) => row.code)).toEqual([exam.code]);
  });

  it("with --production, loads an empty database", async () => {
    await clearCatalogue(db());
    const result = await seedCommand({ args: ["--production"] });

    expect(result.code).toBe(0);
    expect(result.out).toMatch(/^Loaded the catalogue into the production database:/);
    expect(result.out).not.toContain("sample Staff");
    expect(await catalogue()).toEqual(CATALOGUE_SEED);
  });

  it("with --production, never adds Staff", async () => {
    await clearCatalogue(db());
    await db().delete(schema.staff);
    expect(await seedCatalogue(db(), CATALOGUE_SEED, { production: true })).toMatchObject({
      ok: true,
      sampleStaff: null,
    });
    expect(await db().select().from(schema.staff)).toEqual([]);
  });

  it("with --production --check, reports what an empty database would get, and writes nothing", async () => {
    await clearCatalogue(db());
    const result = await seedCommand({ args: ["--production", "--check"] });

    expect(result).toEqual({
      code: 0,
      err: "",
      out: [
        "Dry run: would load into the production database:",
        ...formatSeedCounts(seedCounts(CATALOGUE_SEED)).map((line) => `  ${line}`),
        "Nothing was written.",
      ].join("\n"),
    });
    expect(await db().select().from(schema.exams)).toEqual([]);
    expect(await db().select().from(schema.websiteSettings)).toEqual([]);
  });

  it('with --production --check, reports "would refuse" on a database with catalogue data, and exits 1', async () => {
    await mark();
    const result = await seedCommand({ args: ["--production", "--check"] });

    expect(result).toEqual({
      code: 1,
      out: "",
      err: "Dry run: would refuse: catalogue data exists. --production only loads an empty catalogue, and never deletes. Nothing was written.",
    });
    expect(await contactEmail()).toBe(MARKER);
  });

  it("dry-runs in a read-only transaction, with reads only", async () => {
    await clearCatalogue(db());
    if (!database.sql) throw new Error("No test database: this suite should have been skipped.");
    const statements: string[] = [];
    const watched = drizzle(database.sql, {
      schema,
      logger: { logQuery: (query) => statements.push(query) },
    });
    expect(await planCatalogueSeed(watched, CATALOGUE_SEED)).toMatchObject({ ok: true });
    const [first, ...rest] = statements;
    expect(first).toBe("set transaction read only");
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.filter((query) => !/^select /i.test(query))).toEqual([]);
  });

  it("never prints DATABASE_URL", async () => {
    const url = process.env.TEST_DATABASE_URL ?? "";
    const outputs = [
      await seedCommand({}),
      await seedCommand({ args: ["--production"] }),
      await seedCommand({ args: ["--production", "--check"] }),
      await seedCommand({ seed: { exams: "nope" } }),
    ];
    for (const { out, err } of outputs) expect(out + err).not.toContain(url);
  });
});
