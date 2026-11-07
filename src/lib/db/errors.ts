/**
 * Telling a database that can't be reached from one that refused a query, and
 * saying so without the connection string: a network error's message names the
 * host, and a login error's names the user, so only codes are ever shown.
 */

/** The codes postgres.js and Node give when Postgres can't be reached or the connection drops. */
const CONNECTION_FAILURES = new Set([
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
  "CONNECTION_ENDED",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

/** The error's own code, when it has one. */
const codeOf = (error: Error): string | null =>
  "code" in error && typeof error.code === "string" ? error.code : null;

/**
 * Pure: the first error in the chain that matches, looking through Drizzle's
 * query wrapper to its cause, and into the first of an AggregateError (Node
 * tries each address a host resolves to, and reports them together).
 */
function findInChain(error: unknown, matches: (error: Error) => boolean): Error | null {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    if (matches(current)) return current;
    const errors: unknown[] = current instanceof AggregateError ? current.errors : [];
    current = errors[0] ?? current.cause;
  }
  return null;
}

/**
 * Pure: the code of a failure to reach Postgres (e.g. "CONNECT_TIMEOUT"), or
 * null when the database answered and refused something.
 */
export function connectionFailureCode(error: unknown): string | null {
  const failure = findInChain(error, (e) => CONNECTION_FAILURES.has(codeOf(e) ?? ""));
  return failure ? codeOf(failure) : null;
}

/**
 * Pure: the SQLSTATE of an error Postgres answered with (e.g. "42P01", a
 * missing table), or null. Its message is never used: it may name the user.
 */
export function postgresErrorCode(error: unknown): string | null {
  const refusal = findInChain(error, (e) => e.name === "PostgresError");
  return refusal ? codeOf(refusal) : null;
}

/** A read that failed because the database didn't answer. Its message names no host. */
export class DatabaseUnreachableError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(
      `The database didn't answer (${code}). Check that it is running and that DATABASE_URL points at it.`,
    );
    this.name = "DatabaseUnreachableError";
    this.code = code;
  }
}

/** `error` as the seams throw it: a DatabaseUnreachableError when the database didn't answer. */
export function asDatabaseError(error: unknown): unknown {
  const code = connectionFailureCode(error);
  return code ? new DatabaseUnreachableError(code) : error;
}
