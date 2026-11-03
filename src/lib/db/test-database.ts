import postgres, { type Sql, type TransactionSql } from "postgres";
import { afterAll, describe } from "vitest";

/**
 * The database tests' connection to local Supabase (`*.db.test.ts`, run alone
 * by `pnpm test:db`). It reads TEST_DATABASE_URL, never DATABASE_URL, so a
 * test run can't switch the app's seams to the database. When the variable is
 * unset or the database doesn't answer, the tests skip with the reason, and
 * `pnpm test` stays green with no Docker. CI sets TEST_DATABASE_REQUIRED=true,
 * so there a missing database fails the run instead of skipping it.
 */
export type TestDatabase = { sql: Sql; skipReason?: never } | { sql?: never; skipReason: string };

const HOW_TO_RUN =
  "Run `pnpm db:start`, then set TEST_DATABASE_URL to the local database " +
  "(README → Local database).";

/** The error's code (e.g. ECONNREFUSED), never its message, which may echo the host. */
function failureCode(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "connection failed";
}

async function connect(url: string | undefined): Promise<TestDatabase> {
  if (!url) return { skipReason: `TEST_DATABASE_URL is not set. ${HOW_TO_RUN}` };
  let sql: Sql | undefined;
  try {
    sql = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
    await sql`select 1`;
    return { sql };
  } catch (error) {
    await sql?.end({ timeout: 0 });
    return {
      skipReason: `TEST_DATABASE_URL is unreachable (${failureCode(error)}). ${HOW_TO_RUN}`,
    };
  }
}

export async function openTestDatabase(url = process.env.TEST_DATABASE_URL): Promise<TestDatabase> {
  const database = await connect(url);
  if (database.skipReason && process.env.TEST_DATABASE_REQUIRED === "true") {
    throw new Error(`The database tests need a database: ${database.skipReason}`);
  }
  return database;
}

/**
 * A suite that needs the database. Without one it is skipped, its title and a
 * console note saying why. `db()` gives the connection inside hooks and tests.
 */
export function describeWithDatabase(
  name: string,
  database: TestDatabase,
  body: (db: () => Sql) => void,
) {
  const { sql, skipReason } = database;
  if (skipReason) console.warn(`[database tests] ${name}: skipped. ${skipReason}`);
  describe.skipIf(!sql)(skipReason ? `${name} (skipped: ${skipReason})` : name, () => {
    afterAll(async () => {
      await sql?.end();
    });
    body(() => {
      if (!sql) throw new Error("No test database: this suite should have been skipped.");
      return sql;
    });
  });
}

class RolledBack extends Error {}

/** Runs `body` in a transaction that is always rolled back, returning its result: a test's fixture. */
export async function rolledBack<T>(
  sql: Sql,
  body: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
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
