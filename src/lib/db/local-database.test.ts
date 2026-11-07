import { describe, expect, it } from "vitest";

import { isLocalDatabase } from "./local-database";

// Whether a connection string reaches only this machine: `pnpm catalogue:seed`
// without --production, and the sample data's reset route, refuse any other.

describe("isLocalDatabase", () => {
  it.each([
    ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", true],
    ["postgresql://postgres:postgres@localhost:54322/postgres", true],
    ["postgresql://postgres:postgres@[::1]:54322/postgres", true],
    ["postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres", false],
    ["postgresql://postgres:pw@db.abc.supabase.co:5432/postgres", false],
    ["postgresql://postgres:pw@localhost.example.com:5432/postgres", false],
    ["postgresql://postgres:pw@127.0.0.1.nip.io:5432/postgres", false],
    ["nonsense", null],
  ])("reads %s as local: %s", (url, expected) => {
    expect(isLocalDatabase(url)).toBe(expected);
  });
});
