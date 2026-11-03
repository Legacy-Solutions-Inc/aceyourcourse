// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  checkReport,
  type CheckCommand,
  configPostgresMajor,
  type DatabaseFacts,
  EXPECTED_BUCKET,
  localMigrationVersions,
  runDatabaseCheck,
} from "./check";

// `pnpm db:check`'s report and refusals, with no database. Reading a real
// database (read-only, deny-all fixtures) is checked in check.db.test.ts.

const LOCAL = { migrations: ["20261103050233", "20261103082502"], postgresMajor: 17 };

const COUNTS = {
  exams: 3,
  subjects: 12,
  liveProducts: 7,
  comingSoonProducts: 2,
  photos: 20,
  listings: 15,
  reviews: 30,
  faqs: 10,
  examPages: 3,
  websiteSettings: 1,
  owners: 1,
  editors: 0,
  invites: 0,
};

const HEALTHY: DatabaseFacts = {
  postgresVersion: "17.4",
  appliedMigrations: ["20261103050233", "20261103082502"],
  publicTables: 18,
  denyAll: [],
  bucket: {
    public: EXPECTED_BUCKET.public,
    fileSizeLimit: EXPECTED_BUCKET.fileSizeLimit,
    allowedMimeTypes: [...EXPECTED_BUCKET.allowedMimeTypes],
  },
  counts: COUNTS,
};

describe("the local facts db:check compares against", () => {
  it("takes each migration's version from its file name, in order, ignoring other files", () => {
    expect(
      localMigrationVersions([
        "20261103082502_catalogue.sql",
        "meta",
        "20261103050233_revoke_default_privileges.sql",
        "README.md",
      ]),
    ).toEqual(["20261103050233", "20261103082502"]);
  });

  it("reads the Postgres major version from supabase/config.toml's [db] table", () => {
    expect(
      configPostgresMajor("[api]\nport = 54321\n\n[db]\nport = 54322\nmajor_version = 17\n"),
    ).toBe(17);
    expect(configPostgresMajor("[db]\nmajor_version = 17 # the hosted project's\n")).toBe(17);
    expect(configPostgresMajor("[db]\nport = 54322\n\n[studio]\nmajor_version = 15\n")).toBeNull();
  });
});

describe("db:check's report", () => {
  it("passes a healthy database, listing what it found", () => {
    const report = checkReport(HEALTHY, LOCAL);
    expect(report.ok).toBe(true);
    expect(report.lines).toEqual([
      "✓ Postgres 17.4, the same major version as supabase/config.toml (17)",
      "✓ Migrations: all 2 in supabase/migrations are applied",
      "✓ Deny-all: 18 tables in public, each with RLS on and no policy or grant for the browser roles",
      '✓ Storage bucket "catalogue": public, 10 MB limit, image/jpeg, image/png, image/webp',
      "  Catalogue: 3 Exams, 12 Subjects, 9 Products (7 Live, 2 Coming Soon), 20 photos, 15 Listings, 30 Reviews, 10 FAQs, 3 Exam pages, 1 Website settings row",
      "  Staff: 1 Owner, 0 Editors, 0 Invites",
      "All checks passed. Nothing was written.",
    ]);
  });

  it("fails on a table with RLS off or a policy for anon, naming the table", () => {
    const report = checkReport(
      {
        ...HEALTHY,
        denyAll: [
          "public.open_rows: RLS is off",
          'public.products: policy "anyone reads" for anon',
        ],
      },
      LOCAL,
    );
    expect(report.ok).toBe(false);
    expect(report.lines).toContain("✗ Deny-all: 2 problems");
    expect(report.lines).toContain("    public.open_rows: RLS is off");
    expect(report.lines).toContain('    public.products: policy "anyone reads" for anon');
    expect(report.lines.at(-1)).toBe("1 check failed. Nothing was written.");
  });

  it("fails when a local migration isn't applied, or the database has one the folder doesn't", () => {
    const report = checkReport(
      { ...HEALTHY, appliedMigrations: ["20261103050233", "20261231000000"] },
      LOCAL,
    );
    expect(report.ok).toBe(false);
    expect(report.lines).toEqual(
      expect.arrayContaining([
        "✗ Migrations: 1 of 2 in supabase/migrations applied",
        "    not applied: 20261103082502 (run supabase db push)",
        "    applied, but not in supabase/migrations: 20261231000000",
      ]),
    );
  });

  it("fails when the database has no migration history at all", () => {
    const report = checkReport({ ...HEALTHY, appliedMigrations: null }, LOCAL);
    expect(report.ok).toBe(false);
    expect(report.lines).toContain(
      "✗ Migrations: none applied (no supabase_migrations.schema_migrations; run supabase db push)",
    );
  });

  it("fails on another Postgres major version than local", () => {
    const report = checkReport({ ...HEALTHY, postgresVersion: "15.8" }, LOCAL);
    expect(report.ok).toBe(false);
    expect(report.lines[0]).toBe(
      "✗ Postgres 15.8, but supabase/config.toml has major_version = 17",
    );
  });

  it("fails on a missing bucket, or one with other limits", () => {
    expect(checkReport({ ...HEALTHY, bucket: null }, LOCAL).lines).toContain(
      '✗ Storage bucket "catalogue" is missing (its migration creates it: supabase db push)',
    );
    const loose = checkReport(
      {
        ...HEALTHY,
        bucket: { public: false, fileSizeLimit: null, allowedMimeTypes: null },
      },
      LOCAL,
    );
    expect(loose.ok).toBe(false);
    expect(loose.lines).toContain(
      '✗ Storage bucket "catalogue": private, no size limit, any file type (expected public, 10 MB limit, image/jpeg, image/png, image/webp)',
    );
  });

  it("reports an empty catalogue without failing: the one-time seed comes after", () => {
    const report = checkReport({ ...HEALTHY, counts: { ...COUNTS, exams: 0, subjects: 0 } }, LOCAL);
    expect(report.ok).toBe(true);
  });

  it("fails when a catalogue table is missing, so nothing could be counted", () => {
    const report = checkReport({ ...HEALTHY, counts: null }, LOCAL);
    expect(report.ok).toBe(false);
    expect(report.lines).toContain(
      "✗ Catalogue: a catalogue table is missing, so nothing could be counted",
    );
  });

  it("fails when supabase/config.toml names no major version to compare with", () => {
    const report = checkReport(HEALTHY, { ...LOCAL, postgresMajor: null });
    expect(report.ok).toBe(false);
    expect(report.lines[0]).toBe(
      "✗ Postgres 17.4, but supabase/config.toml names no [db] major_version",
    );
  });
});

const SECRET = "s3cret-Passw0rd";
const HOSTED_NOWHERE = `postgresql://postgres.abc:${SECRET}@db.nowhere.invalid:6543/postgres`;

async function run(command: Partial<CheckCommand>) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runDatabaseCheck({
    databaseUrl: undefined,
    connectTimeoutSeconds: 2,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    ...command,
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("db:check command: refusals", () => {
  it.each([undefined, ""])("exits 1 asking for DATABASE_URL when it is %j", async (databaseUrl) => {
    const result = await run({ databaseUrl });
    expect(result).toEqual({
      code: 1,
      out: "",
      err: "DATABASE_URL is not set. Set it to the database to check. Nothing was checked.",
    });
  });

  it("exits 1 on a DATABASE_URL that isn't a URL, without printing it", async () => {
    const result = await run({ databaseUrl: `not a url ${SECRET}` });
    expect(result.code).toBe(1);
    expect(result.err).toBe("DATABASE_URL is not a valid connection string. Nothing was checked.");
    expect(result.err).not.toContain(SECRET);
  });

  it("exits 1 when run outside the repo's root, before connecting", async () => {
    const result = await run({
      databaseUrl: HOSTED_NOWHERE,
      migrationsDir: "no/such/folder",
    });
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      "Couldn't read supabase/migrations and supabase/config.toml: run db:check from the repo's root. Nothing was checked.",
    );
  });

  it("exits 1 on an unreachable database with only the error's code, never the URL", async () => {
    const result = await run({ databaseUrl: HOSTED_NOWHERE });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^Couldn't reach the database \([A-Z_]+\)\. Nothing was checked\.$/);
    for (const text of [result.out, result.err]) {
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("nowhere.invalid");
    }
  });
});
