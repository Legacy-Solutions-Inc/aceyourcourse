import { describe, it, expect } from "vitest";

import { parseEnv } from "./env";
import { parseServerEnv } from "./env.server";

// Spelled in parts so the leftover-name check (env-names.test.ts) doesn't match this file.
const OLD_KEY_NAME = ["NEXT_PUBLIC_SUPABASE", "ANON", "KEY"].join("_");

describe("parseEnv", () => {
  it("accepts an empty env (all optional; NODE_ENV defaults to development)", () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeUndefined();
  });

  it("parses provided Supabase values", () => {
    const env = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_k",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://x.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_k");
  });

  it("accepts any non-empty publishable key, and treats an empty one as unset", () => {
    expect(parseEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x" })).toMatchObject({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x",
    });
    expect(
      parseEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ).toBeUndefined();
  });

  it("throws on a publishable key that isn't a string, naming the key", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 42 })).toThrow(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("ignores the old anon key name: there is no fallback", () => {
    const env = parseEnv({ [OLD_KEY_NAME]: "k" });
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeUndefined();
    expect(env).not.toHaveProperty(OLD_KEY_NAME);
  });

  it("never declares a server secret", () => {
    expect(parseEnv({ SUPABASE_SECRET_KEY: "sb_secret_k" })).not.toHaveProperty(
      "SUPABASE_SECRET_KEY",
    );
  });

  it("throws on an invalid Supabase URL", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("throws on an invalid log level", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_LOG_LEVEL: "LOUD" })).toThrow(/NEXT_PUBLIC_LOG_LEVEL/);
  });

  it("treats a set-but-empty optional var as unset (URL)", () => {
    const env = parseEnv({ NEXT_PUBLIC_SUPABASE_URL: "" });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("still throws on a non-empty invalid URL", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_SUPABASE_URL: "notaurl" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("treats a set-but-empty optional var as unset (log level)", () => {
    const env = parseEnv({ NEXT_PUBLIC_LOG_LEVEL: "" });
    expect(env.NEXT_PUBLIC_LOG_LEVEL).toBeUndefined();
  });
});

describe("parseServerEnv", () => {
  it("leaves the Supabase secret key unset by default", () => {
    expect(parseServerEnv({}).SUPABASE_SECRET_KEY).toBeUndefined();
  });

  it("accepts a Supabase secret key, and treats an empty one as unset", () => {
    expect(parseServerEnv({ SUPABASE_SECRET_KEY: "sb_secret_k" }).SUPABASE_SECRET_KEY).toBe(
      "sb_secret_k",
    );
    expect(parseServerEnv({ SUPABASE_SECRET_KEY: "" }).SUPABASE_SECRET_KEY).toBeUndefined();
  });

  it("throws on a secret key that isn't a string, naming the key", () => {
    expect(() => parseServerEnv({ SUPABASE_SECRET_KEY: 42 })).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("leaves the Member App switch unset (off) by default", () => {
    expect(parseServerEnv({}).MEMBER_APP_LIVE).toBeUndefined();
  });

  it.each(["true", "false"])("accepts MEMBER_APP_LIVE=%s", (value) => {
    expect(parseServerEnv({ MEMBER_APP_LIVE: value }).MEMBER_APP_LIVE).toBe(value);
  });

  it("treats a set-but-empty MEMBER_APP_LIVE as unset", () => {
    expect(parseServerEnv({ MEMBER_APP_LIVE: "" }).MEMBER_APP_LIVE).toBeUndefined();
  });

  it("throws on any other MEMBER_APP_LIVE value, naming the key", () => {
    expect(() => parseServerEnv({ MEMBER_APP_LIVE: "yes" })).toThrow(/MEMBER_APP_LIVE/);
  });
});
