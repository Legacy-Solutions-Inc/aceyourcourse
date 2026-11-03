import { parseArgs } from "node:util";

import { connectDatabase } from "@/lib/db/connect";
import { connectionFailureCode, postgresErrorCode } from "@/lib/db/errors";
import { isLocalDatabase, LOCAL_DATABASE_URL } from "@/lib/db/local-database";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { formatSampleStaff, formatSeedCounts, seedCatalogue } from "./seed";

// ─────────────────────────────────────────────────────────────────────────────
// pnpm catalogue:seed [--local | --production]
//
// Loads the Phase 1 seed into the catalogue tables (seed.ts):
//   --local       the local Supabase database (`pnpm db:reset` runs this),
//                 replacing its catalogue and adding the sample Staff
//   (no flag)     DATABASE_URL, the same; a local database only
//   --production  DATABASE_URL, once: refuses when any catalogue data exists,
//                 never deletes, and never adds Staff
// It never prints DATABASE_URL: a failure shows only its code.
// ─────────────────────────────────────────────────────────────────────────────

const USAGE = "Usage: pnpm catalogue:seed [--local | --production]";

export interface SeedCommand {
  args: string[];
  /** DATABASE_URL, which is never printed. */
  databaseUrl: string | undefined;
  /** Tests load other seeds; the command loads the Phase 1 seed. */
  seed?: unknown;
  connectTimeoutSeconds?: number;
  log(line: string): void;
  error(line: string): void;
}

/** What to check for the Postgres errors a seed most often meets, by SQLSTATE class or code. */
const HINTS: [RegExp, string][] = [
  [/^28/, "Check the user and password in DATABASE_URL."],
  [/^3D000$/, "Check the database name in DATABASE_URL."],
  [
    /^42P01$/,
    "Are the migrations applied? (pnpm db:reset locally, supabase db push in production)",
  ],
];

/**
 * Pure: the lines the command prints when loading failed. Only error codes:
 * a network error's message names the host, and a login error's the user.
 */
export function describeSeedFailure(failure: unknown, target: string): string[] {
  const unreachable = connectionFailureCode(failure);
  if (unreachable) return [`Couldn't reach ${target} (${unreachable}). Nothing was written.`];
  const refused = postgresErrorCode(failure);
  if (refused) {
    const hint = HINTS.find(([pattern]) => pattern.test(refused))?.[1];
    return [
      `Postgres refused the seed in ${target} (${refused}). Nothing was written.`,
      ...(hint ? [hint] : []),
    ];
  }
  return ["Loading the catalogue failed. Nothing was written."];
}

/** Runs the command and gives its exit code. */
export async function runCatalogueSeed(command: SeedCommand): Promise<number> {
  const { log, error } = command;

  let flags: { local: boolean; production: boolean };
  try {
    const parsed = parseArgs({
      args: command.args,
      options: {
        local: { type: "boolean", default: false },
        production: { type: "boolean", default: false },
      },
    });
    flags = { local: parsed.values.local === true, production: parsed.values.production === true };
  } catch {
    error(USAGE);
    return 1;
  }
  if (flags.local && flags.production) {
    error(`--local and --production can't be used together.\n${USAGE}`);
    return 1;
  }

  const url = flags.local ? LOCAL_DATABASE_URL : command.databaseUrl;
  if (!url) {
    error("DATABASE_URL is not set. Set it, or use --local for the local Supabase database.");
    return 1;
  }
  const local = isLocalDatabase(url);
  if (local === null) {
    error("DATABASE_URL is not a valid connection string.");
    return 1;
  }
  if (!flags.production && !local) {
    error(
      "Without --production, catalogue:seed replaces the catalogue, so it only runs against a " +
        "local database. Nothing was written.\nTo load an empty hosted database once, use --production.",
    );
    return 1;
  }

  const target = flags.production ? "the production database" : "the local database";
  const connection = connectDatabase(url, {
    connectTimeoutSeconds: command.connectTimeoutSeconds,
    max: 1,
  });
  try {
    const outcome = await seedCatalogue(connection.db, command.seed ?? CATALOGUE_SEED, {
      production: flags.production,
    });
    if (!outcome.ok && outcome.reason === "invalid") {
      error(`The seed has ${outcome.errors.length} problem(s). Nothing was written.`);
      for (const problem of outcome.errors) error(`  ${problem}`);
      return 1;
    }
    if (!outcome.ok) {
      error(
        "The database already has catalogue data. --production only loads an empty catalogue, " +
          "and never deletes. Nothing was written.",
      );
      return 1;
    }
    log(`Loaded the catalogue into ${target}:`);
    for (const line of formatSeedCounts(outcome.counts)) log(`  ${line}`);
    if (outcome.sampleStaff) log(`  ${formatSampleStaff(outcome.sampleStaff)}`);
    return 0;
  } catch (failure) {
    for (const line of describeSeedFailure(failure, target)) error(line);
    return 1;
  } finally {
    await connection.close();
  }
}
