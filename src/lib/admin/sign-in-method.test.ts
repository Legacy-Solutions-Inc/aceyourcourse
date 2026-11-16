import { describe, expect, it } from "vitest";

import { passwordSignInPermitted, signInMethodCounts } from "./sign-in-method";

// Which sign-in methods count for the Admin (ticket 19; CONVENTIONS §3). The
// session's verified `amr` claim says how it signed in: `oauth` (Google)
// counts everywhere, `password` only where the password box is allowed, and
// nothing else ever. Where the box is allowed (ticket 24): live mode, under
// `pnpm dev` or with the ADMIN_PASSWORD_SIGN_IN switch "true".

const at = (method: string) => ({ method, timestamp: 1_793_750_400 });

describe("passwordSignInPermitted", () => {
  const modes = ["live", "sample", "closed"] as const;
  const nodeEnvs = ["development", "test", "production", undefined] as const;
  const switches = ["true", "false", undefined] as const;
  const table = modes.flatMap((adminMode) =>
    nodeEnvs.flatMap((nodeEnv) =>
      switches.map((passwordSwitch) => ({
        adminMode,
        nodeEnv,
        passwordSwitch,
        allowed: adminMode === "live" && (nodeEnv === "development" || passwordSwitch === "true"),
      })),
    ),
  );

  it.each(table)(
    "is $allowed in $adminMode mode, NODE_ENV $nodeEnv, switch $passwordSwitch",
    ({ adminMode, nodeEnv, passwordSwitch, allowed }) => {
      expect(passwordSignInPermitted({ adminMode, nodeEnv, passwordSwitch })).toBe(allowed);
    },
  );

  it("is allowed in a production build in live mode only with the switch exactly true", () => {
    const production = { adminMode: "live", nodeEnv: "production" } as const;
    expect(passwordSignInPermitted({ ...production, passwordSwitch: "true" })).toBe(true);
    expect(passwordSignInPermitted({ ...production, passwordSwitch: "false" })).toBe(false);
    expect(passwordSignInPermitted({ ...production, passwordSwitch: undefined })).toBe(false);
  });
});

describe("signInMethodCounts", () => {
  it.each([true, false])("counts a Google (oauth) sign-in (password allowed: %s)", (allowed) => {
    expect(signInMethodCounts([at("oauth")], allowed)).toBe(true);
  });

  it.each([
    [true, true],
    [false, false],
  ])("counts a password sign-in only where allowed (%s)", (allowed, counts) => {
    expect(signInMethodCounts([at("password")], allowed)).toBe(counts);
  });

  it.each([true, false])(
    "never counts otp, magiclink, anonymous or token_refresh alone (password allowed: %s)",
    (allowed) => {
      for (const method of ["otp", "magiclink", "anonymous", "token_refresh", "totp"]) {
        expect(signInMethodCounts([at(method)], allowed)).toBe(false);
      }
    },
  );

  it.each([true, false])(
    "counts a session whose methods include one that counts (password allowed: %s)",
    (allowed) => {
      expect(signInMethodCounts([at("totp"), at("oauth")], allowed)).toBe(true);
    },
  );

  it.each([true, false])(
    "never counts an empty, missing or unreadable amr (password allowed: %s)",
    (allowed) => {
      for (const amr of [
        [],
        undefined,
        null,
        "oauth",
        "password",
        ["oauth"],
        ["password"],
        [{ method: 1 }],
        { method: "oauth" },
        { method: "password" },
      ]) {
        expect(signInMethodCounts(amr, allowed)).toBe(false);
      }
    },
  );
});
