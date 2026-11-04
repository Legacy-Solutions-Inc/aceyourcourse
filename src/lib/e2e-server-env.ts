import { isLocalDatabase } from "@/lib/db/local-database";

// ─────────────────────────────────────────────────────────────────────────────
// The env playwright.config.ts gives the e2e server (ticket 16). No test may
// touch the hosted Supabase project, which .env names for `pnpm dev`, and Next
// loads .env for any variable the process doesn't set. So:
// - By default the e2e server runs on the in-memory sample data: the
//   database, Supabase and secret-key variables are set, empty. Next never
//   replaces a variable that is set, and the env schemas read "" as unset.
// - With all four PLAYWRIGHT_* values (CI, from the runner's local Supabase),
//   it runs live on that Supabase. Each URL must name this machine.
// ─────────────────────────────────────────────────────────────────────────────

const LIVE_VARIABLES = [
  "PLAYWRIGHT_DATABASE_URL",
  "PLAYWRIGHT_SUPABASE_URL",
  "PLAYWRIGHT_SUPABASE_PUBLISHABLE_KEY",
  "PLAYWRIGHT_SUPABASE_SECRET_KEY",
] as const;

export interface E2eServer {
  /** The Admin's mode on the e2e server: the in-memory sample data, or live. */
  mode: "sample" | "live";
  env: {
    DATABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
    SUPABASE_SECRET_KEY: string;
  };
}

/** Pure: the e2e server's database and Supabase env, from the shell running Playwright. */
export function e2eServerEnv(shell: Record<string, string | undefined>): E2eServer {
  const set = LIVE_VARIABLES.filter((name) => shell[name]);
  if (set.length === 0) {
    return {
      mode: "sample",
      env: {
        DATABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
        SUPABASE_SECRET_KEY: "",
      },
    };
  }
  const missing = LIVE_VARIABLES.filter((name) => !shell[name]);
  if (missing.length > 0) {
    throw new Error(
      "Set all of PLAYWRIGHT_DATABASE_URL, PLAYWRIGHT_SUPABASE_URL, " +
        "PLAYWRIGHT_SUPABASE_PUBLISHABLE_KEY and PLAYWRIGHT_SUPABASE_SECRET_KEY for a live run, " +
        `or none. Missing: ${missing.join(", ")}.`,
    );
  }
  for (const name of ["PLAYWRIGHT_DATABASE_URL", "PLAYWRIGHT_SUPABASE_URL"] as const) {
    if (isLocalDatabase(shell[name] ?? "") !== true) {
      throw new Error(
        `${name} must point at this machine (localhost or 127.0.0.1). The e2e run stopped.`,
      );
    }
  }
  return {
    mode: "live",
    env: {
      DATABASE_URL: shell.PLAYWRIGHT_DATABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_URL: shell.PLAYWRIGHT_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: shell.PLAYWRIGHT_SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_SECRET_KEY: shell.PLAYWRIGHT_SUPABASE_SECRET_KEY ?? "",
    },
  };
}
