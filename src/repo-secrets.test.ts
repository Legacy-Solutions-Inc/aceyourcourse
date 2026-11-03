// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// No production secret is ever committed (ticket 18): the hosted project's
// keys, database password and Google client secret live only in Vercel and in
// the Supabase and Google dashboards. This scans every tracked file, and every
// new one not yet added (never ignored ones such as .env), for their shapes.
// The patterns and the samples below are spelled in parts, so this file
// doesn't match itself.

/** Hosts a connection string may name a password for: this machine, where it's no secret. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Passwords the tests and docs use as stand-ins. Any other password in a
 * connection string to another machine is taken as real.
 */
const STAND_IN_PASSWORDS = new Set(["pw", "pass", "password", "secret", "postgres", "placeholder"]);

/** A placeholder rather than a value: <password>, [YOUR-PASSWORD], ${SECRET}, …, ***. */
const PLACEHOLDER = /^(<[^>]*>|\[[^\]]*\]|\$\{[^}]*\}|\{[^}]*\}|[.…*x]+)$/i;

const KEY_PATTERNS: { name: string; pattern: RegExp }[] = [
  // Supabase's secret key (bypasses RLS), and a personal access token.
  {
    name: "a Supabase secret key",
    pattern: new RegExp(["sb", "secret", "[A-Za-z0-9_-]{20,}"].join("_")),
  },
  { name: "a Supabase access token", pattern: new RegExp(["sbp", "[a-f0-9]{40}"].join("_")) },
  // A legacy JWT key (service_role or anon): three base64url parts.
  {
    name: "a JWT",
    pattern: new RegExp(
      ["eyJ[A-Za-z0-9_-]{20,}", "eyJ[A-Za-z0-9_-]{20,}", "[A-Za-z0-9_-]{20,}"].join("\\."),
    ),
  },
  {
    name: "a Google client secret",
    pattern: new RegExp(["GOCSPX", "[A-Za-z0-9_-]{20,}"].join("-")),
  },
];

const CONNECTION_STRING = new RegExp(
  ["postgres(?:ql)?:", "", "([^:/@\\s]+):([^@\\s]+)@(\\[[^\\]]+\\]|[^/:\\s?]+)"].join("/"),
  "g",
);

/** Pure: what in `text` looks like a production secret, one line each. */
function secretsIn(text: string): string[] {
  const found = KEY_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
  for (const [, , password = "", host = ""] of text.matchAll(CONNECTION_STRING)) {
    const standIn =
      LOCAL_HOSTS.has(host) || STAND_IN_PASSWORDS.has(password) || PLACEHOLDER.test(password);
    if (!standIn) found.push(`a connection string with a password, to ${host}`);
  }
  return found;
}

/** Tracked files plus new ones not yet added, without ignored files (.env). */
function repoFiles(): string[] {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  return listed.split("\0").filter((file) => file && existsSync(file));
}

/** A file's text, or null for a binary file (an image, a font). */
function textOf(file: string): string | null {
  const bytes = readFileSync(file);
  return bytes.includes(0) ? null : bytes.toString("utf8");
}

describe("the secret scan", () => {
  it("finds a Supabase secret key shaped like a real one", () => {
    const key = ["sb", "secret", "N7xQ2vLk9TzR4mWb8YcHs1Ef3Ga6Pd0"].join("_");
    expect(secretsIn(`SUPABASE_SECRET_KEY=${key}`)).toEqual(["a Supabase secret key"]);
  });

  it("finds a Google client secret and a legacy JWT key", () => {
    const google = ["GOCSPX", "Ab12Cd34Ef56Gh78Ij90Kl12Mn"].join("-");
    const part = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const jwt = [part, part, "Qx9w8e7r6t5y4u3i2o1pAsDfGhJkL"].join(".");
    expect(secretsIn(`${google}\n${jwt}`)).toEqual(["a JWT", "a Google client secret"]);
  });

  it("finds a hosted connection string with a real-looking password", () => {
    const url = [
      "postgresql:",
      "",
      "postgres.abcdefghijklmnop:Xq7-vB2kLm9z@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ].join("/");
    expect(secretsIn(url)).toEqual([
      "a connection string with a password, to aws-0-ap-southeast-1.pooler.supabase.com",
    ]);
  });

  it("passes placeholders, stand-in passwords and the local database", () => {
    const scheme = ["postgresql:", "", ""].join("/");
    const samples = [
      `${scheme}postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
      `${scheme}postgres:[YOUR-PASSWORD]@db.abc.supabase.co:5432/postgres`,
      `${scheme}postgres:postgres@127.0.0.1:54322/postgres`,
      `${scheme}postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
      ["sb", "secret", "…"].join("_"),
    ];
    expect(samples.flatMap(secretsIn)).toEqual([]);
  });

  it("finds nothing secret in any file in the repo", () => {
    const found = repoFiles().flatMap((file) => {
      const text = textOf(file);
      return text === null ? [] : secretsIn(text).map((secret) => `${file}: ${secret}`);
    });
    expect(found).toEqual([]);
  });
});

describe("the production runbook", () => {
  const runbook = "docs/runbooks/production.md";

  it("names no real email address: the first Owner's is typed at deployment", () => {
    const emails = readFileSync(runbook, "utf8").match(/[\w.%+-]+@[\w-]+(\.[\w-]+)+/g) ?? [];
    expect(emails).toEqual([]);
  });
});
