import "server-only";

import { z } from "zod";

/**
 * Server-only environment. The companion to `src/env.ts`, which validates the
 * PUBLIC (`NEXT_PUBLIC_*`) vars. This module holds the first server secret —
 * `DATABASE_URL` — and is split out exactly as `src/env.ts` anticipated:
 * server secrets are validated apart and, thanks to the `import "server-only"`
 * marker above, can never be referenced from — and thus never inlined into —
 * the client bundle. Do NOT reference `DATABASE_URL` from `src/env.ts`,
 * `src/config.ts`, or any client component.
 */

/**
 * A set-but-empty env var (`""`) — common in Docker/CI, where it usually means
 * "unset" — should behave as absent, not as an invalid value. Coerce `""` to
 * `undefined` BEFORE validation, so empty passes `.optional()` while a genuinely
 * invalid non-empty value (e.g. `"notaurl"`) still hard-fails. Mirrors the same
 * helper in `src/env.ts`.
 */
function optionalEnv<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema);
}

const serverEnvSchema = z.object({
  // Optional so the template still runs with no database configured (the
  // in-memory mock is the default). When set, it must be a valid URL.
  DATABASE_URL: optionalEnv(z.string().url().optional()),
});

/** The validated, typed server environment. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Pure: validate a raw environment object. On failure, throws a fail-fast Error
 * whose message names every invalid/missing key. Exported for testing.
 */
export function parseServerEnv(raw: Record<string, unknown>): ServerEnv {
  const result = serverEnvSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment variables — ${details}`);
  }
  return result.data;
}

// Reference the variable by its literal name (never spread `process.env`) and
// validate at import — a misconfiguration then fails loudly, not later.
export const serverEnv = parseServerEnv({
  DATABASE_URL: process.env.DATABASE_URL,
});

/**
 * Fact: is a database connection string configured? When false, the service
 * seam resolves to the in-memory mock (see `src/services/customers.ts`).
 */
export const isDatabaseConfigured = Boolean(serverEnv.DATABASE_URL);
