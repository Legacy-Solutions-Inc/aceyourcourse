import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { runClientBundleCheck } from "@/lib/client-bundle";

// ─────────────────────────────────────────────────────────────────────────────
// pnpm check:bundle (after pnpm build)
//
// Reads everything a browser can receive from the build in .next (the static
// chunks, and the pages Next prerendered) for the name of any server-only
// variable in src/env.server.ts, and for the value of any of them set in this
// shell that's long enough to be a secret. Prints where each one is, never a
// value, and exits 1 when any is found. See src/lib/client-bundle.ts, and
// docs/security-review.md.
// ─────────────────────────────────────────────────────────────────────────────

const NEXT_DIR = ".next";

/** Every file under .next, by its path from the app's folder, or null when there's no build. */
function builtFiles(): string[] | null {
  try {
    return readdirSync(NEXT_DIR, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name).split(path.sep).join("/"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

process.exitCode = runClientBundleCheck({
  builtFiles,
  read: (file) => readFileSync(file, "latin1"),
  envServerSource: readFileSync("src/env.server.ts", "utf8"),
  env: process.env,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});
