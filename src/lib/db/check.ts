import { readdirSync, readFileSync } from "node:fs";

import type { Sql, TransactionSql } from "postgres";

import { CATALOGUE_BUCKET } from "@/lib/catalogue-bucket";
import { connectSql } from "@/lib/db/connect";
import { connectionFailureCode, postgresErrorCode } from "@/lib/db/errors";
import { isLocalDatabase } from "@/lib/db/local-database";
import { MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES } from "@/services/uploads.types";

// ─────────────────────────────────────────────────────────────────────────────
// pnpm db:check (scripts/db-check.ts): a read-only health check of the
// database DATABASE_URL names, local or hosted, for the production runbook
// (docs/runbooks/production.md). It reports
//   - the Postgres version, against supabase/config.toml's major_version
//   - the migrations applied, against supabase/migrations
//   - deny-all: every table in public has RLS on and no policy or grant for
//     the browser roles, and storage.objects no policy for them
//   - the catalogue bucket and its limits
//   - the catalogue and staff counts
// and exits 1 when any check fails. Every query runs in one READ ONLY
// transaction, so it can't write. It never prints DATABASE_URL: a failure
// shows only its code.
// ─────────────────────────────────────────────────────────────────────────────

/** The roles the browser's publishable key reaches Postgres as. */
const BROWSER_ROLES = ["anon", "authenticated"];

/** What the bucket's migration (…_catalogue_bucket.sql) sets: the upload rules. */
export const EXPECTED_BUCKET = {
  public: true,
  fileSizeLimit: MAX_UPLOAD_BYTES,
  allowedMimeTypes: UPLOAD_CONTENT_TYPES,
} as const;

/** A connection, or a transaction on one. */
type Client = Sql | TransactionSql;

/** Every way a browser role could reach a relation in `schema`, one line per problem. */
export async function denyAllViolations(sql: Client, schema: string): Promise<string[]> {
  const rlsOff = await sql<{ name: string }[]>`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relkind in ('r', 'p') and not c.relrowsecurity`;
  // A policy for `public` applies to every role, the browser roles included.
  const policies = await browserPolicies(sql, schema);
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
    ...policies,
    ...grants.map(
      ({ name, privilege, grantee }) => `${schema}.${name}: ${privilege} granted to ${grantee}`,
    ),
  ].sort();
}

/** The policies in `schema` that let a browser role in, one line each. */
async function browserPolicies(sql: Client, schema: string, table?: string): Promise<string[]> {
  const rows = await sql<{ name: string; policy: string; roles: string[] }[]>`
    select tablename as name, policyname as policy, roles::text[] as roles
    from pg_policies
    where schemaname = ${schema}
      and (${table ?? null}::text is null or tablename = ${table ?? null})
      and roles && array['public', 'anon', 'authenticated']::name[]`;
  return rows.map(
    ({ name, policy, roles }) => `${schema}.${name}: policy "${policy}" for ${roles.join(", ")}`,
  );
}

// ── What the database holds ─────────────────────────────────────────────────

export interface CatalogueCounts {
  exams: number;
  subjects: number;
  liveProducts: number;
  comingSoonProducts: number;
  photos: number;
  listings: number;
  reviews: number;
  faqs: number;
  examPages: number;
  sitePages: number;
  websiteSettings: number;
  owners: number;
  editors: number;
  invites: number;
}

export interface BucketFacts {
  public: boolean;
  fileSizeLimit: number | null;
  allowedMimeTypes: string[] | null;
}

export interface DatabaseFacts {
  /** server_version, e.g. "17.4". */
  postgresVersion: string;
  /** The versions in supabase_migrations.schema_migrations; null when it doesn't exist. */
  appliedMigrations: string[] | null;
  publicTables: number;
  /** Every way a browser role reaches a table, one line each; empty when deny-all holds. */
  denyAll: string[];
  /** The catalogue bucket; null when it (or Storage) doesn't exist. */
  bucket: BucketFacts | null;
  /** Null when a catalogue table isn't there (migrations missing or out of date). */
  counts: CatalogueCounts | null;
}

/** Runs `body` in a READ ONLY transaction: any write in it fails (SQLSTATE 25006). */
export async function readOnly<T>(sql: Sql, body: (tx: TransactionSql) => Promise<T>): Promise<T> {
  let result: { value: T } | undefined;
  await sql.begin("read only", async (tx) => {
    result = { value: await body(tx) };
  });
  if (!result) throw new Error("The read-only transaction never finished.");
  return result.value;
}

const exists = async (tx: Client, relation: string) => {
  const [row] = await tx<
    { found: boolean }[]
  >`select to_regclass(${relation}) is not null as found`;
  return row?.found === true;
};

async function catalogueCounts(tx: TransactionSql): Promise<CatalogueCounts | null> {
  try {
    // A savepoint, so a missing table leaves the transaction usable.
    return await tx.savepoint(async (sp) => {
      const [row] = await sp<CatalogueCounts[]>`
        select
          (select count(*) from exams)::int as exams,
          (select count(*) from subjects)::int as subjects,
          (select count(*) from products where state = 'live')::int as "liveProducts",
          (select count(*) from products where state = 'coming-soon')::int as "comingSoonProducts",
          (select count(*) from product_photos)::int as photos,
          (select count(*) from product_listings)::int as listings,
          (select count(*) from reviews)::int as reviews,
          (select count(*) from faqs)::int as faqs,
          (select count(*) from exam_pages)::int as "examPages",
          (select count(*) from site_pages)::int as "sitePages",
          (select count(*) from website_settings)::int as "websiteSettings",
          (select count(*) from staff where status = 'active' and role = 'owner')::int as owners,
          (select count(*) from staff where status = 'active' and role = 'editor')::int as editors,
          (select count(*) from staff where status = 'invited')::int as invites`;
      if (!row) throw new Error("The counts query returned no row.");
      return row;
    });
  } catch (error) {
    if (postgresErrorCode(error) === "42P01") return null;
    throw error;
  }
}

/** Reads what db:check reports, inside the caller's transaction (readOnly in the command). */
export async function readDatabaseFacts(tx: TransactionSql): Promise<DatabaseFacts> {
  const [version] = await tx<{ server_version: string }[]>`show server_version`;
  const appliedMigrations = (await exists(tx, "supabase_migrations.schema_migrations"))
    ? (
        await tx<{ version: string }[]>`
          select version from supabase_migrations.schema_migrations order by version`
      ).map((row) => row.version)
    : null;
  const [tables] = await tx<{ count: number }[]>`
    select count(*)::int as count
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')`;
  const hasStorage = await exists(tx, "storage.buckets");
  const denyAll = [
    ...(await denyAllViolations(tx, "public")),
    ...(hasStorage ? await browserPolicies(tx, "storage", "objects") : []),
  ];
  const [bucket] = hasStorage
    ? await tx<
        { public: boolean; fileSizeLimit: string | null; allowedMimeTypes: string[] | null }[]
      >`
        select public, file_size_limit::text as "fileSizeLimit",
               allowed_mime_types as "allowedMimeTypes"
        from storage.buckets where id = ${CATALOGUE_BUCKET}`
    : [];
  return {
    postgresVersion: version?.server_version ?? "unknown",
    appliedMigrations,
    publicTables: tables?.count ?? 0,
    denyAll,
    bucket: bucket
      ? {
          public: bucket.public,
          fileSizeLimit: bucket.fileSizeLimit === null ? null : Number(bucket.fileSizeLimit),
          allowedMimeTypes: bucket.allowedMimeTypes,
        }
      : null,
    counts: await catalogueCounts(tx),
  };
}

// ── What this checkout expects ──────────────────────────────────────────────

export interface LocalFacts {
  /** The versions of supabase/migrations' files, in order. */
  migrations: string[];
  /** supabase/config.toml's [db] major_version, or null. */
  postgresMajor: number | null;
}

/** Pure: each migration's version (its timestamp prefix), in order, from the folder's file names. */
export function localMigrationVersions(fileNames: readonly string[]): string[] {
  return fileNames
    .map((name) => /^(\d+)_.*\.sql$/.exec(name)?.[1])
    .filter((version): version is string => version !== undefined)
    .sort();
}

/** Pure: supabase/config.toml's [db] major_version, or null. */
export function configPostgresMajor(toml: string): number | null {
  const db = /^\[db\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(toml)?.[1] ?? "";
  const version = /^\s*major_version\s*=\s*(\d+)\s*(#.*)?$/m.exec(db)?.[1];
  return version ? Number(version) : null;
}

/** This checkout's facts, or null when its folder and config can't be read. */
function readLocalFacts(migrationsDir: string, configPath: string): LocalFacts | null {
  try {
    return {
      migrations: localMigrationVersions(readdirSync(migrationsDir)),
      postgresMajor: configPostgresMajor(readFileSync(configPath, "utf8")),
    };
  } catch {
    return null;
  }
}

// ── The report ──────────────────────────────────────────────────────────────

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

function describeBucket(bucket: BucketFacts | typeof EXPECTED_BUCKET): string {
  return [
    bucket.public ? "public" : "private",
    bucket.fileSizeLimit === null ? "no size limit" : `${megabytes(bucket.fileSizeLimit)} limit`,
    bucket.allowedMimeTypes?.length ? bucket.allowedMimeTypes.join(", ") : "any file type",
  ].join(", ");
}

const sameBucket = (bucket: BucketFacts) =>
  bucket.public === EXPECTED_BUCKET.public &&
  bucket.fileSizeLimit === EXPECTED_BUCKET.fileSizeLimit &&
  [...(bucket.allowedMimeTypes ?? [])].sort().join() ===
    [...EXPECTED_BUCKET.allowedMimeTypes].sort().join();

function describeCounts(counts: CatalogueCounts): string[] {
  const products = counts.liveProducts + counts.comingSoonProducts;
  return [
    "  Catalogue: " +
      [
        plural(counts.exams, "Exam"),
        plural(counts.subjects, "Subject"),
        `${plural(products, "Product")} (${counts.liveProducts} Live, ${counts.comingSoonProducts} Coming Soon)`,
        plural(counts.photos, "photo"),
        plural(counts.listings, "Listing"),
        plural(counts.reviews, "Review"),
        plural(counts.faqs, "FAQ"),
        plural(counts.examPages, "Exam page"),
        plural(counts.sitePages, "Site page"),
        plural(counts.websiteSettings, "Website settings row"),
      ].join(", "),
    describeStaff(counts),
  ];
}

/** The staff list's line, as db:check and `pnpm staff:add-owner` both print it. */
export function describeStaff(counts: Pick<CatalogueCounts, "owners" | "editors" | "invites">) {
  return `  Staff: ${plural(counts.owners, "Owner")}, ${plural(counts.editors, "Editor")}, ${plural(counts.invites, "Invite")}`;
}

/** Pure: db:check's lines for what it read, and whether every check passed. */
export function checkReport(
  facts: DatabaseFacts,
  local: LocalFacts,
): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let failed = 0;
  const pass = (line: string) => lines.push(`✓ ${line}`);
  const fail = (line: string, details: string[] = []) => {
    failed++;
    lines.push(`✗ ${line}`, ...details.map((detail) => `    ${detail}`));
  };

  const major = Number.parseInt(facts.postgresVersion, 10);
  if (local.postgresMajor === null) {
    fail(`Postgres ${facts.postgresVersion}, but supabase/config.toml names no [db] major_version`);
  } else if (major === local.postgresMajor) {
    pass(
      `Postgres ${facts.postgresVersion}, the same major version as supabase/config.toml (${local.postgresMajor})`,
    );
  } else {
    fail(
      `Postgres ${facts.postgresVersion}, but supabase/config.toml has major_version = ${local.postgresMajor}`,
    );
  }

  if (facts.appliedMigrations === null) {
    fail(
      "Migrations: none applied (no supabase_migrations.schema_migrations; run supabase db push)",
    );
  } else {
    const applied = new Set(facts.appliedMigrations);
    const known = new Set(local.migrations);
    const missing = local.migrations.filter((version) => !applied.has(version));
    const unknown = facts.appliedMigrations.filter((version) => !known.has(version));
    if (missing.length === 0 && unknown.length === 0) {
      pass(`Migrations: all ${local.migrations.length} in supabase/migrations are applied`);
    } else {
      fail(
        `Migrations: ${local.migrations.length - missing.length} of ${local.migrations.length} in supabase/migrations applied`,
        [
          ...missing.map((version) => `not applied: ${version} (run supabase db push)`),
          ...unknown.map((version) => `applied, but not in supabase/migrations: ${version}`),
        ],
      );
    }
  }

  if (facts.denyAll.length === 0) {
    pass(
      `Deny-all: ${facts.publicTables} tables in public, each with RLS on and no policy or grant for the browser roles`,
    );
  } else {
    fail(`Deny-all: ${plural(facts.denyAll.length, "problem")}`, facts.denyAll);
  }

  if (!facts.bucket) {
    fail(
      `Storage bucket "${CATALOGUE_BUCKET}" is missing (its migration creates it: supabase db push)`,
    );
  } else if (sameBucket(facts.bucket)) {
    pass(`Storage bucket "${CATALOGUE_BUCKET}": ${describeBucket(facts.bucket)}`);
  } else {
    fail(
      `Storage bucket "${CATALOGUE_BUCKET}": ${describeBucket(facts.bucket)} (expected ${describeBucket(EXPECTED_BUCKET)})`,
    );
  }

  if (facts.counts) lines.push(...describeCounts(facts.counts));
  else fail("Catalogue: a catalogue table is missing, so nothing could be counted");
  lines.push(
    failed === 0
      ? "All checks passed. Nothing was written."
      : `${plural(failed, "check")} failed. Nothing was written.`,
  );
  return { ok: failed === 0, lines };
}

// ── The command ─────────────────────────────────────────────────────────────

export interface CheckCommand {
  /** DATABASE_URL, which is never printed. */
  databaseUrl: string | undefined;
  /** Tests point these elsewhere; the command reads this checkout's. */
  migrationsDir?: string;
  configPath?: string;
  connectTimeoutSeconds?: number;
  log(line: string): void;
  error(line: string): void;
}

/** Runs the check and gives its exit code: 0 when every check passed. */
export async function runDatabaseCheck(command: CheckCommand): Promise<number> {
  const { databaseUrl: url, log, error } = command;
  if (!url) {
    error("DATABASE_URL is not set. Set it to the database to check. Nothing was checked.");
    return 1;
  }
  const local = isLocalDatabase(url);
  if (local === null) {
    error("DATABASE_URL is not a valid connection string. Nothing was checked.");
    return 1;
  }

  const expected = readLocalFacts(
    command.migrationsDir ?? "supabase/migrations",
    command.configPath ?? "supabase/config.toml",
  );
  if (!expected) {
    error(
      "Couldn't read supabase/migrations and supabase/config.toml: run db:check from the " +
        "repo's root. Nothing was checked.",
    );
    return 1;
  }
  const sql = connectSql(url, { connectTimeoutSeconds: command.connectTimeoutSeconds, max: 1 });
  try {
    const facts = await readOnly(sql, readDatabaseFacts);
    log(`Checking ${local ? "the local database" : "a database on another machine"} (read-only):`);
    const report = checkReport(facts, expected);
    for (const line of report.lines) log(line);
    return report.ok ? 0 : 1;
  } catch (failure) {
    const unreachable = connectionFailureCode(failure);
    const refused = postgresErrorCode(failure);
    error(
      unreachable
        ? `Couldn't reach the database (${unreachable}). Nothing was checked.`
        : refused
          ? `Postgres refused the check (${refused}). Nothing was checked.`
          : "The check failed. Nothing was checked.",
    );
    return 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
