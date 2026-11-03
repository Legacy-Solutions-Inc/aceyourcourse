import { parseArgs } from "node:util";

import { connectDatabase } from "@/lib/db/connect";
import { connectionFailureCode, postgresErrorCode } from "@/lib/db/errors";
import { isLocalDatabase, LOCAL_DATABASE_URL, LOCAL_SUPABASE_URL } from "@/lib/db/local-database";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { PhotoUploadError, type SeedPhotos, storageSeedPhotos } from "./photos";
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
// Every load uploads the seed's photos into the Storage bucket (ticket 17):
// local Supabase's for --local, NEXT_PUBLIC_SUPABASE_URL's otherwise, with
// SUPABASE_SECRET_KEY. It never prints DATABASE_URL or the key: a failure
// shows only its code.
// ─────────────────────────────────────────────────────────────────────────────

const USAGE = "Usage: pnpm catalogue:seed [--local | --production]";

export interface SeedCommand {
  args: string[];
  /** DATABASE_URL, which is never printed. */
  databaseUrl: string | undefined;
  /** NEXT_PUBLIC_SUPABASE_URL: whose Storage the photos go into, unless --local. */
  supabaseUrl: string | undefined;
  /** SUPABASE_SECRET_KEY, for Storage, which is never printed. */
  secretKey: string | undefined;
  /**
   * Tests give their own photos, or null to keep them at their public/ paths;
   * the command uploads them into Storage.
   */
  photos?: SeedPhotos | null;
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
  if (failure instanceof PhotoUploadError) return [`${failure.message} Nothing was written.`];
  return ["Loading the catalogue failed. Nothing was written."];
}

/** The seed's photos in Storage, or what's missing for them. Never names the key. */
function storagePhotos(
  supabaseUrl: string | undefined,
  secretKey: string | undefined,
  mustBeLocal: boolean,
): { photos: SeedPhotos } | { refusal: string } {
  if (!secretKey) {
    return {
      refusal:
        "SUPABASE_SECRET_KEY is not set. catalogue:seed uploads the seed's photos into Storage " +
        "with it. Nothing was written.",
    };
  }
  if (!supabaseUrl) {
    return {
      refusal:
        "NEXT_PUBLIC_SUPABASE_URL is not set. catalogue:seed uploads the seed's photos into its " +
        "Storage. Nothing was written.",
    };
  }
  // isLocalDatabase checks the host, which works for any URL.
  if (mustBeLocal && isLocalDatabase(supabaseUrl) !== true) {
    return {
      refusal:
        "Without --production, catalogue:seed only uploads to a local Supabase. Nothing was " +
        "written.\nSet NEXT_PUBLIC_SUPABASE_URL to local Supabase, or use --local.",
    };
  }
  return { photos: storageSeedPhotos({ supabaseUrl, secretKey, publicDir: "public" }) };
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

  let photos: SeedPhotos | undefined;
  if (command.photos === undefined) {
    // --local takes .env's Supabase URL when it's local (127.0.0.1 or localhost),
    // so the photos' URLs match what next/image allows and the clean-up deletes.
    const localUrl =
      command.supabaseUrl && isLocalDatabase(command.supabaseUrl) === true
        ? command.supabaseUrl
        : LOCAL_SUPABASE_URL;
    const storage = storagePhotos(
      flags.local ? localUrl : command.supabaseUrl,
      command.secretKey,
      !flags.production,
    );
    if ("refusal" in storage) {
      error(storage.refusal);
      return 1;
    }
    photos = storage.photos;
  } else {
    photos = command.photos ?? undefined;
  }

  const target = flags.production ? "the production database" : "the local database";
  const connection = connectDatabase(url, {
    connectTimeoutSeconds: command.connectTimeoutSeconds,
    max: 1,
  });
  try {
    const outcome = await seedCatalogue(connection.db, command.seed ?? CATALOGUE_SEED, {
      production: flags.production,
      photos,
    });
    if (!outcome.ok && outcome.reason === "invalid") {
      error(`The seed has ${outcome.errors.length} problem(s). Nothing was written.`);
      for (const problem of outcome.errors) error(`  ${problem}`);
      return 1;
    }
    if (!outcome.ok && outcome.reason === "photos") {
      error(`The seed's photos have ${outcome.problems.length} problem(s). Nothing was written.`);
      for (const problem of outcome.problems) error(`  ${problem}`);
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
    if (outcome.uploadedPhotos !== null) {
      log(`  ${outcome.uploadedPhotos} photos uploaded into the Storage bucket`);
    }
    return 0;
  } catch (failure) {
    for (const line of describeSeedFailure(failure, target)) error(line);
    return 1;
  } finally {
    await connection.close();
  }
}
