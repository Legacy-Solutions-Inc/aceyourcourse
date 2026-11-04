import { describe, expect, it } from "vitest";

import { signInMethodCounts } from "./sign-in-method";

// Which sign-in methods count for the Admin (ticket 19; CONVENTIONS §3). The
// session's verified `amr` claim says how it signed in: `oauth` (Google)
// counts everywhere, `password` only under `pnpm dev`, and nothing else ever.

const at = (method: string) => ({ method, timestamp: 1_793_750_400 });

describe("signInMethodCounts", () => {
  it.each([
    ["development", true],
    ["production", true],
    ["test", true],
  ])("counts a Google (oauth) sign-in in %s", (nodeEnv, counts) => {
    expect(signInMethodCounts([at("oauth")], nodeEnv)).toBe(counts);
  });

  it.each([
    ["development", true],
    ["production", false],
    ["test", false],
    [undefined, false],
  ])("counts a password sign-in only in development (%s)", (nodeEnv, counts) => {
    expect(signInMethodCounts([at("password")], nodeEnv)).toBe(counts);
  });

  it.each(["development", "production", "test"])(
    "never counts otp, magiclink, anonymous or token_refresh alone (%s)",
    (nodeEnv) => {
      for (const method of ["otp", "magiclink", "anonymous", "token_refresh", "totp"]) {
        expect(signInMethodCounts([at(method)], nodeEnv)).toBe(false);
      }
    },
  );

  it.each(["development", "production"])(
    "counts a session whose methods include one that counts (%s)",
    (nodeEnv) => {
      expect(signInMethodCounts([at("totp"), at("oauth")], nodeEnv)).toBe(true);
    },
  );

  it.each(["development", "production", "test"])(
    "never counts an empty, missing or unreadable amr (%s)",
    (nodeEnv) => {
      for (const amr of [
        [],
        undefined,
        null,
        "oauth",
        ["oauth"],
        [{ method: 1 }],
        { method: "oauth" },
      ]) {
        expect(signInMethodCounts(amr, nodeEnv)).toBe(false);
      }
    },
  );
});
