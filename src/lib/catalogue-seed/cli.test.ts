// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { describeSeedFailure, runCatalogueSeed, type SeedCommand } from "./cli";

// `pnpm catalogue:seed`'s command, with no database: every case here is
// refused, or fails to connect, before anything is written. Its output never
// shows DATABASE_URL. Writing to Postgres is checked in seed.db.test.ts.

const SECRET = "s3cret-Passw0rd";
/** A local database URL nothing listens on (port 1), so connecting is refused at once. */
const LOCAL_NOBODY = `postgresql://postgres:${SECRET}@127.0.0.1:1/postgres`;
/** A hosted-looking URL whose host can't exist (.invalid never resolves). */
const HOSTED_NOWHERE = `postgresql://postgres.abc:${SECRET}@db.nowhere.invalid:6543/postgres`;

async function run(command: Partial<SeedCommand>) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCatalogueSeed({
    args: [],
    databaseUrl: undefined,
    supabaseUrl: undefined,
    secretKey: undefined,
    // Keeps the photos in public/: the Storage cases below set their own.
    photos: null,
    connectTimeoutSeconds: 2,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    ...command,
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

/** The command's whole output never contains the connection string or its password. */
function expectNoSecret(output: { out: string; err: string }, url: string) {
  for (const text of [output.out, output.err]) {
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(url);
  }
}

describe("catalogue:seed command: refusals", () => {
  it("refuses an unknown flag with the usage", async () => {
    const result = await run({ args: ["--force"], databaseUrl: LOCAL_NOBODY });
    expect(result).toMatchObject({
      code: 1,
      err: "Usage: pnpm catalogue:seed [--local | --production]",
    });
  });

  it("refuses --local and --production together", async () => {
    const result = await run({ args: ["--local", "--production"] });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/can't be used together/);
  });

  it.each([undefined, ""])("asks for DATABASE_URL when it is %j", async (databaseUrl) => {
    const result = await run({ databaseUrl });
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      "DATABASE_URL is not set. Set it, or use --local for the local Supabase database.",
    );
  });

  it("refuses a DATABASE_URL that isn't a URL, without printing it", async () => {
    const url = `not a url ${SECRET}`;
    const result = await run({ databaseUrl: url });
    expect(result).toMatchObject({
      code: 1,
      err: "DATABASE_URL is not a valid connection string.",
    });
    expectNoSecret(result, url);
  });

  it("replaces the catalogue only on a local database: a hosted one needs --production", async () => {
    const result = await run({ databaseUrl: HOSTED_NOWHERE });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/only runs against a local database\. Nothing was written\./);
    expect(result.err).toMatch(/use --production/);
    expectNoSecret(result, HOSTED_NOWHERE);
  });

  it("refuses an invalid seed with its problems, before connecting", async () => {
    const seed = structuredClone(CATALOGUE_SEED);
    const soon = seed.products.find((p) => p.state === "coming-soon");
    if (!soon) throw new Error("the seed has no Coming Soon Product");
    soon.priceFrom = 50000;

    const result = await run({ databaseUrl: LOCAL_NOBODY, seed });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^The seed has 1 problem\(s\)\. Nothing was written\./);
    expect(result.err).toMatch(/priceFrom: a Coming Soon Product has no price/);
    // Port 1 refuses every connection: had it connected, the error would say so.
    expect(result.err).not.toMatch(/Couldn't reach/);
  });
});

describe("catalogue:seed command: Storage for the photos (ticket 17)", () => {
  const SECRET_KEY = "sb_secret_s3cret-value";
  // Port 1 again: none of these may reach a real database or Storage.
  const storage = {
    photos: undefined,
    databaseUrl: LOCAL_NOBODY,
    supabaseUrl: "http://127.0.0.1:1",
    secretKey: SECRET_KEY,
  };

  it("asks for SUPABASE_SECRET_KEY before connecting, since the photos go to Storage", async () => {
    const result = await run({ ...storage, secretKey: undefined });
    expect(result).toMatchObject({
      code: 1,
      err: "SUPABASE_SECRET_KEY is not set. catalogue:seed uploads the seed's photos into Storage with it. Nothing was written.",
    });
  });

  it("asks for NEXT_PUBLIC_SUPABASE_URL when not loading the local database", async () => {
    const result = await run({
      ...storage,
      args: ["--production"],
      databaseUrl: HOSTED_NOWHERE,
      supabaseUrl: undefined,
    });
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      "NEXT_PUBLIC_SUPABASE_URL is not set. catalogue:seed uploads the seed's photos into its Storage. Nothing was written.",
    );
    expectNoSecret(result, HOSTED_NOWHERE);
  });

  it("refuses to put a local load's photos into a hosted Supabase", async () => {
    const result = await run({
      ...storage,
      databaseUrl: LOCAL_NOBODY,
      supabaseUrl: "https://abcdefgh.supabase.co",
    });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/only uploads to a local Supabase\. Nothing was written\./);
  });

  it("aborts on a missing seed photo before connecting, never printing the key", async () => {
    const [product] = CATALOGUE_SEED.products.filter((p) => p.photos.length > 0);
    const gone = product?.photos[0]?.src;
    const result = await run({
      databaseUrl: LOCAL_NOBODY,
      photos: {
        read: async (src) => (src === gone ? null : new Uint8Array([1])),
        upload: async () => {
          throw new Error("nothing should be uploaded");
        },
      },
    });
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      `The seed's photos have 1 problem(s). Nothing was written.\n  ${gone}: no such file in public/`,
    );
  });

  it("never prints the secret key", async () => {
    const outputs = [
      await run({ ...storage, secretKey: SECRET_KEY, supabaseUrl: undefined }),
      await run({ ...storage, supabaseUrl: "https://x.supabase.co" }),
    ];
    for (const { out, err } of outputs) expect(out + err).not.toContain(SECRET_KEY);
  });
});

describe("catalogue:seed command: an unreachable database", () => {
  it("says it couldn't reach the local database, with only the error's code", async () => {
    const result = await run({ databaseUrl: LOCAL_NOBODY });
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      "Couldn't reach the local database (ECONNREFUSED). Nothing was written.",
    );
    expectNoSecret(result, LOCAL_NOBODY);
  });

  it("never prints the production DATABASE_URL, even when its host doesn't exist", async () => {
    const result = await run({ args: ["--production"], databaseUrl: HOSTED_NOWHERE });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(
      /^Couldn't reach the production database \((ENOTFOUND|EAI_AGAIN)\)\./,
    );
    expectNoSecret(result, HOSTED_NOWHERE);
    expect(result.err).not.toContain("nowhere.invalid");
  });
});

/** An error as postgres.js gives it when Postgres answers with one, wrapped by Drizzle. */
function postgresError(code: string, message: string) {
  const cause = Object.assign(new Error(message), { name: "PostgresError", code });
  return new Error(`Failed query: insert into "exams" ...`, { cause });
}

describe("catalogue:seed command: what a failure says", () => {
  it("names a failed login by its code only, never the user it names", () => {
    const lines = describeSeedFailure(
      postgresError("28P01", `password authentication failed for user "postgres.abcdefgh"`),
      "the production database",
    );
    expect(lines).toEqual([
      "Postgres refused the seed in the production database (28P01). Nothing was written.",
      "Check the user and password in DATABASE_URL.",
    ]);
    expect(lines.join("\n")).not.toContain("abcdefgh");
  });

  it("asks whether the migrations are applied when a table is missing", () => {
    expect(
      describeSeedFailure(
        postgresError("42P01", `relation "exams" does not exist`),
        "the local database",
      ),
    ).toEqual([
      "Postgres refused the seed in the local database (42P01). Nothing was written.",
      "Are the migrations applied? (pnpm db:reset locally, supabase db push in production)",
    ]);
  });

  it("gives just the code for any other refusal", () => {
    expect(
      describeSeedFailure(postgresError("23505", "duplicate key"), "the local database"),
    ).toEqual(["Postgres refused the seed in the local database (23505). Nothing was written."]);
  });

  it("finds an unreachable host inside an AggregateError, by its code", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });
    const lines = describeSeedFailure(new AggregateError([refused]), "the local database");
    expect(lines).toEqual([
      "Couldn't reach the local database (ECONNREFUSED). Nothing was written.",
    ]);
  });

  it("says only that loading failed for anything else, never the error's message", () => {
    expect(
      describeSeedFailure(new Error("postgresql://u:secret@host/db"), "the local database"),
    ).toEqual(["Loading the catalogue failed. Nothing was written."]);
  });
});
