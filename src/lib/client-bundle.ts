// ─────────────────────────────────────────────────────────────────────────────
// The client bundle check (security review, Phase 5 ticket 05): what a
// browser can receive from a build must never name a server-only variable,
// nor hold a secret's value. src/env.server.ts is the list of server-only
// variables; `import "server-only"` already fails the build should a client
// module import it, and this reads the build's output to confirm nothing got
// through another way. `pnpm check:bundle` (scripts/check-client-bundle.ts)
// runs it after `pnpm build`, giving it the files and the shell's env; it
// reads src/env.server.ts as text, since that module can't be imported
// outside the server. Pure.
// ─────────────────────────────────────────────────────────────────────────────

/** One file of the build's output, by its path from the app's folder. */
export interface OutputFile {
  file: string;
  text: string;
}

/** Where a server-only variable showed up: its name, or the value it's set to (never repeated here). */
export interface ClientOutputLeak {
  file: string;
  name: string;
  found: "name" | "value";
}

/** A value shorter than this isn't looked for: switches like "true" are everywhere. */
const SHORTEST_SECRET = 16;

/**
 * Pure: the server-only variables, from src/env.server.ts's source: each one
 * the schema is given as `NAME: process.env.NAME`, in order.
 */
export function serverOnlyNames(envServerSource: string): string[] {
  return [...envServerSource.matchAll(/^\s*([A-Z][A-Z0-9_]*): process\.env\.\1,/gm)].flatMap(
    ([, name]) => (name ? [name] : []),
  );
}

/**
 * Pure: whether a browser can receive this file of the build's output, by its
 * path: every static asset, and each page Next prerendered (its HTML and its
 * RSC payload). Server bundles, caches and traces stay on the server.
 */
export function isClientOutput(file: string): boolean {
  if (file.startsWith(".next/static/")) return true;
  return /^\.next\/server\/(app|pages)\/.+\.(html|rsc|body)$/.test(file);
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Pure: every file that names a server-only variable (a whole name, not the
 * end of a longer one), or holds the value of one set in `values` that's long
 * enough to be a secret. The value itself is never given back.
 */
export function clientOutputLeaks(
  files: readonly OutputFile[],
  names: readonly string[],
  values: Readonly<Record<string, string | undefined>>,
): ClientOutputLeak[] {
  const leaks: ClientOutputLeak[] = [];
  for (const { file, text } of files) {
    for (const name of names) {
      if (new RegExp(`(?<![A-Z0-9_])${escaped(name)}(?![A-Z0-9_])`).test(text)) {
        leaks.push({ file, name, found: "name" });
      }
      const value = values[name]?.trim();
      if (value && value.length >= SHORTEST_SECRET && text.includes(value)) {
        leaks.push({ file, name, found: "value" });
      }
    }
  }
  return leaks;
}

/** What the check reads, given by the script: the build, the server env's source and the shell's env. */
export interface ClientBundleCheckInputs {
  /** Every file of the build in .next, by its path from the app's folder; null when there's no build. */
  builtFiles: () => string[] | null;
  read: (file: string) => string;
  /** src/env.server.ts, as text. */
  envServerSource: string;
  env: Readonly<Record<string, string | undefined>>;
  log: (line: string) => void;
  error: (line: string) => void;
}

/**
 * Pure but for what it's given: the whole check, as `pnpm check:bundle` runs
 * it. Prints where each server-only name or secret value is, never a value,
 * or that there's none. The exit code: 0 when the client output is clean, 1
 * when anything is found or there's no build to read.
 */
export function runClientBundleCheck(inputs: ClientBundleCheckInputs): number {
  const built = inputs.builtFiles();
  if (built === null) {
    inputs.error("There's no build in .next: run pnpm build first.");
    return 1;
  }
  const output = built.filter(isClientOutput).map((file) => ({ file, text: inputs.read(file) }));
  const names = serverOnlyNames(inputs.envServerSource);
  const leaks = clientOutputLeaks(output, names, inputs.env);
  if (leaks.length === 0) {
    inputs.log(
      `No server-only variable's name or secret value in the client output: ` +
        `${output.length} files checked for ${names.length} names.`,
    );
    return 0;
  }
  for (const { file, name, found } of leaks) {
    inputs.error(`${file}: ${found === "name" ? "names" : "holds the value of"} ${name}`);
  }
  return 1;
}
