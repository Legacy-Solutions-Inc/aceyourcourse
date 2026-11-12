import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// The sign-in screen and its actions in live mode (ticket 16): "Continue with
// Google" starts Google's sign-in, with no "Sign in as" list. Staff already
// signed in go straight on. Under `pnpm dev`, while Supabase has Email on,
// the "Development only" password box signs in too (ticket 19). Supabase is
// the boundary: its server client's auth calls and the public settings it
// serves (fetch) are replaced. The staff list is the sample one, through the
// Admin seam's sample arm.
const { auth, jar } = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    getClaims: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  jar: new Map<string, string>(),
}));

vi.mock("@/lib/admin/mode", () => ({ adminMode: "live" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const GOOGLE = "http://127.0.0.1:54321/auth/v1/authorize?provider=google";
const OWNER = "angel@aceyourcourse.ph";

/** Signs in to Supabase as this email (null: signed out), by Google unless said otherwise. */
function signedInAs(email: string | null, method = "oauth") {
  auth.getClaims.mockResolvedValue(
    email
      ? { data: { claims: { sub: "u1", amr: [{ method, timestamp: 0 }] } }, error: null }
      : { data: null, error: null },
  );
  const user = email
    ? ({
        id: "u1",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-11-04T00:00:00Z",
        email,
        email_confirmed_at: "2026-11-04T00:00:00Z",
      } satisfies User)
    : null;
  auth.getUser.mockResolvedValue({ data: { user }, error: null });
}

/** Supabase's public auth settings, with Google on or off, and Email off unless said. */
function googleProvider(enabled: boolean, email = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ external: { google: enabled, email } })),
  );
}

/** Loads the modules as `pnpm dev` runs them. */
function underPnpmDev() {
  vi.stubEnv("NODE_ENV", "development");
  vi.resetModules();
}

const devBox = () => screen.queryByRole("region", { name: "Development only" });

const props = (params: { next?: string; error?: string } = {}) => ({
  searchParams: Promise.resolve(params),
});
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

beforeEach(() => {
  jar.clear();
  resetSampleStore();
  signedInAs(null);
  auth.signInWithOAuth.mockResolvedValue({ data: { url: GOOGLE }, error: null });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000/");
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sign-in screen (live mode)", () => {
  it("offers Continue with Google, sending next with it, and no Sign in as list", async () => {
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props({ next: "/admin/products" })));

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sign in as" })).not.toBeInTheDocument();
    expect(screen.queryByText(/SAMPLE DATA/)).not.toBeInTheDocument();
    const next = document.querySelector<HTMLInputElement>('input[name="next"]');
    expect(next?.value).toBe("/admin/products");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends Staff already signed in to next, recording nothing: it only reads", async () => {
    signedInAs(OWNER);
    const { default: SignInPage } = await import("./page");

    await expect(SignInPage(props({ next: "/admin/reviews" }))).rejects.toThrow(
      "NEXT_REDIRECT /admin/reviews",
    );
    const owner = getSampleStore().staff.find(({ email }) => email === OWNER);
    expect(owner?.lastSignedInAt).toBeNull();
  });

  it("still shows sign-in to a User who isn't Staff, recording nothing", async () => {
    signedInAs("juan.delacruz@gmail.com");
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props()));

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(getSampleStore().deniedSignIns).toEqual([]);
  });

  it.each([
    ["callback", "Sign-in didn't finish. Try again."],
    ["google-not-set-up", "Google sign-in isn't set up on this server"],
    ["unreachable", "Sign-in isn't answering right now. Try again in a minute."],
    ["unverified", "This Google account's email address isn't verified"],
  ])("says why the last sign-in didn't go on (%s)", async (error, message) => {
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props({ error })));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  it("ignores an error it doesn't know", async () => {
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props({ error: "<script>" })));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("continueWithGoogle (live mode)", () => {
  it("sends the browser to Google, coming back through the callback to the sanitised next", async () => {
    googleProvider(true);
    const { continueWithGoogle } = await import("./actions");

    await expect(continueWithGoogle(form({ next: "https://evil.example" }))).rejects.toThrow(
      `NEXT_REDIRECT ${GOOGLE}`,
    );
    expect(auth.signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(
      "http://localhost:3000/auth/callback?next=%2Fadmin",
    );
  });

  it("returns to sign-in saying Google isn't set up, with no crash", async () => {
    googleProvider(false);
    const { continueWithGoogle } = await import("./actions");

    await expect(continueWithGoogle(form({ next: "/admin/faqs" }))).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in?next=%2Fadmin%2Ffaqs&error=google-not-set-up",
    );
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("returns to sign-in saying Supabase didn't answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Bad Gateway", { status: 502 })),
    );
    const { continueWithGoogle } = await import("./actions");

    await expect(continueWithGoogle(form({}))).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in?next=%2Fadmin&error=unreachable",
    );
  });
});

describe("Sign in as (live mode)", () => {
  it("refuses: the sample sign-in doesn't exist here", async () => {
    const { signInAs } = await import("./actions");

    await expect(signInAs({ error: null, email: "" }, form({ email: OWNER }))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

describe("switchAccount (live mode)", () => {
  it("signs out, then starts Google's sign-in again, which asks for the account", async () => {
    googleProvider(true);
    const { switchAccount } = await import("../actions");

    await expect(switchAccount()).rejects.toThrow(`NEXT_REDIRECT ${GOOGLE}`);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signInWithOAuth.mock.invocationCallOrder[0] ?? 0,
    );
    expect(auth.signInWithOAuth.mock.calls[0]?.[0].options.queryParams).toEqual({
      prompt: "select_account",
    });
  });

  it("lands on sign-in saying why when Google can't start, signed out", async () => {
    googleProvider(false);
    const { switchAccount } = await import("../actions");

    await expect(switchAccount()).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in?next=%2Fadmin&error=google-not-set-up",
    );
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});

describe("the Development only password box (ticket 19)", () => {
  it("shows under Continue with Google under pnpm dev, while Supabase says Email is on", async () => {
    underPnpmDev();
    googleProvider(false, true);
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props({ next: "/admin/products" })));

    const google = screen.getByRole("button", { name: "Continue with Google" });
    const box = screen.getByRole("region", { name: "Development only" });
    expect(google.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.querySelector<HTMLInputElement>('input[name="next"]')?.value).toBe(
      "/admin/products",
    );
  });

  it.each([
    ["Supabase says Email is off", () => googleProvider(true, false)],
    [
      "Supabase doesn't answer",
      () =>
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => new Response("", { status: 503 })),
        ),
    ],
    [
      "Supabase can't be reached",
      () =>
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => {
            throw new TypeError("fetch failed");
          }),
        ),
    ],
  ])("is absent under pnpm dev when %s", async (_label, settings) => {
    underPnpmDev();
    settings();
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props()));

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(devBox()).not.toBeInTheDocument();
  });

  it.each(["production", "test"])("is absent in %s, even with Email on", async (nodeEnv) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.resetModules();
    googleProvider(true, true);
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props()));

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(devBox()).not.toBeInTheDocument();
  });
});

describe("the TESTING ONLY password box: a production build with ADMIN_PASSWORD_SIGN_IN (ticket 24)", () => {
  const IDLE = { error: null, fieldErrors: {}, email: "" };
  const testingBox = () => screen.queryByRole("region", { name: "Testing only" });

  /** Loads the modules as a production build with the switch set ("" leaves it unset). */
  function productionWith(passwordSwitch: string) {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD_SIGN_IN", passwordSwitch);
    vi.resetModules();
  }

  /** Supabase signs in as this email by password when the password is right. */
  function passwordUser(email: string, password = "right password") {
    auth.signInWithPassword.mockImplementation(
      async (credentials: { email: string; password: string }) => {
        if (credentials.email !== email || credentials.password !== password) {
          const { AuthApiError } = await import("@supabase/supabase-js");
          return {
            data: { user: null, session: null },
            error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
          };
        }
        signedInAs(email, "password");
        return { data: {}, error: null };
      },
    );
  }

  async function signIn(fields: Record<string, string>) {
    const { signInWithPassword } = await import("./actions");
    return signInWithPassword(IDLE, form(fields));
  }

  it("shows under Continue with Google, headed TESTING ONLY, with the switch true and Email on", async () => {
    productionWith("true");
    googleProvider(true, true);
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props({ next: "/admin/products" })));

    const google = screen.getByRole("button", { name: "Continue with Google" });
    const box = screen.getByRole("region", { name: "Testing only" });
    expect(google.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("TESTING ONLY")).toBeVisible();
    expect(screen.queryByText("DEVELOPMENT ONLY")).not.toBeInTheDocument();
    expect(box.querySelector<HTMLInputElement>('input[name="next"]')?.value).toBe(
      "/admin/products",
    );
  });

  it.each([
    ["Email is off", () => googleProvider(true, false)],
    [
      "Supabase can't be reached",
      () =>
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => {
            throw new TypeError("fetch failed");
          }),
        ),
    ],
  ])("is absent with the switch true when %s", async (_label, settings) => {
    productionWith("true");
    settings();
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props()));

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(testingBox()).not.toBeInTheDocument();
  });

  it("stays headed DEVELOPMENT ONLY under pnpm dev with the switch true", async () => {
    vi.stubEnv("ADMIN_PASSWORD_SIGN_IN", "true");
    underPnpmDev();
    googleProvider(true, true);
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props()));

    expect(devBox()).toBeInTheDocument();
    expect(screen.getByText("DEVELOPMENT ONLY")).toBeVisible();
    expect(testingBox()).not.toBeInTheDocument();
  });

  it.each(["false", ""])("is absent with the switch %j, even with Email on", async (value) => {
    productionWith(value);
    googleProvider(true, true);
    const { default: SignInPage } = await import("./page");
    render(await SignInPage(props()));

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(testingBox()).not.toBeInTheDocument();
    expect(devBox()).not.toBeInTheDocument();
  });

  it("signs the Owner in through the Staff Guard with the switch true, landing on next", async () => {
    productionWith("true");
    passwordUser(OWNER);

    await expect(
      signIn({ email: OWNER, password: "right password", next: "/admin/settings" }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin\/settings$/);
    const owner = getSampleStore().staff.find(({ email }) => email === OWNER);
    expect(owner?.lastSignedInAt).not.toBeNull();
  });

  it("sends a password User who isn't Staff to denied with the switch true", async () => {
    productionWith("true");
    passwordUser("juan.delacruz@gmail.com");

    await expect(
      signIn({ email: "juan.delacruz@gmail.com", password: "right password" }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin\/denied\?reason=not-staff$/);
  });

  it("refuses an unconfirmed email with the switch true, ending the session", async () => {
    productionWith("true");
    auth.signInWithPassword.mockImplementation(async () => {
      signedInAs(OWNER, "password");
      auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: "u1",
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            created_at: "",
            email: OWNER,
          },
        },
        error: null,
      });
      return { data: {}, error: null };
    });

    expect(await signIn({ email: OWNER, password: "pw" })).toMatchObject({
      error:
        "This email isn't confirmed. Confirm the User in the Supabase dashboard, then try again.",
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("shows the box's message for a wrong password with the switch true, never sending it back", async () => {
    productionWith("true");
    passwordUser(OWNER);

    const state = await signIn({ email: OWNER, password: "wrong secret" });
    expect(state).toEqual({
      error: "That email and password don't match.",
      fieldErrors: {},
      email: OWNER,
    });
    expect(JSON.stringify(state)).not.toContain("wrong secret");
  });

  it.each(["false", ""])(
    "answers 404 with the switch %j, whatever is posted, never asking Supabase",
    async (value) => {
      productionWith(value);

      await expect(signIn({ email: OWNER, password: "right password" })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    },
  );

  it("refuses a password session made straight against Supabase with the switch false", async () => {
    productionWith("false");
    signedInAs(OWNER, "password");
    const { getStaff } = await import("@/lib/admin/guard");

    expect(await getStaff()).toBeNull();
  });

  it.each(["true", "false"])("counts a Google session with the switch %s", async (value) => {
    productionWith(value);
    signedInAs(OWNER, "oauth");
    const { getStaff } = await import("@/lib/admin/guard");

    expect(await getStaff()).toMatchObject({ email: OWNER });
  });
});

describe("signInWithPassword (live mode, ticket 19)", () => {
  const IDLE = { error: null, fieldErrors: {}, email: "" };

  /** Supabase signs in as this email when the password is right, as the cookies would carry it. */
  function passwordUser(email: string, password = "right password") {
    auth.signInWithPassword.mockImplementation(
      async (credentials: { email: string; password: string }) => {
        if (credentials.email !== email || credentials.password !== password) {
          const { AuthApiError } = await import("@supabase/supabase-js");
          return {
            data: { user: null, session: null },
            error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
          };
        }
        signedInAs(email, "password");
        return { data: {}, error: null };
      },
    );
  }

  async function signIn(fields: Record<string, string>) {
    const { signInWithPassword } = await import("./actions");
    return signInWithPassword(IDLE, form(fields));
  }

  beforeEach(() => {
    underPnpmDev();
    passwordUser(OWNER);
  });

  it("signs the Owner in through the Staff Guard and lands on next", async () => {
    await expect(
      signIn({ email: OWNER, password: "right password", next: "/admin/settings" }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin\/settings$/);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: OWNER,
      password: "right password",
    });
    const owner = getSampleStore().staff.find(({ email }) => email === OWNER);
    expect(owner?.lastSignedInAt).not.toBeNull();
  });

  it.each(["https://evil.example", "//evil.example", "/app"])(
    "lands on the Overview instead of next=%s",
    async (next) => {
      await expect(signIn({ email: OWNER, password: "right password", next })).rejects.toThrow(
        /^NEXT_REDIRECT \/admin$/,
      );
    },
  );

  it("activates a pending Invite for the email", async () => {
    passwordUser("kim.reyes@gmail.com");
    await expect(
      signIn({ email: "kim.reyes@gmail.com", password: "right password" }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin$/);
    expect(getSampleStore().staff).toContainEqual(
      expect.objectContaining({ email: "kim.reyes@gmail.com", role: "editor" }),
    );
  });

  it("sends a confirmed User who isn't Staff to the 403 screen, recording the attempt", async () => {
    passwordUser("juan.delacruz@gmail.com");
    await expect(
      signIn({ email: "juan.delacruz@gmail.com", password: "right password" }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin\/denied\?reason=not-staff$/);
    expect(getSampleStore().deniedSignIns).toEqual([
      expect.objectContaining({ email: "juan.delacruz@gmail.com", reason: "not-staff" }),
    ]);
  });

  it.each([
    ["a wrong password", { email: OWNER, password: "wrong" }],
    ["an unknown email", { email: "nobody@example.com", password: "right password" }],
  ])(
    "says the email and password don't match for %s, keeping the email",
    async (_label, fields) => {
      expect(await signIn(fields)).toEqual({
        error: "That email and password don't match.",
        fieldErrors: {},
        email: fields.email,
      });
      expect(getSampleStore().deniedSignIns).toEqual([]);
    },
  );

  it.each([
    ["over_request_rate_limit", 429, "Too many tries. Wait a minute and try again."],
    ["email_provider_disabled", 400, "Password sign-in is off on this project."],
    [
      "email_not_confirmed",
      400,
      "This email isn't confirmed. Confirm the User in the Supabase dashboard, then try again.",
    ],
  ])("says why Supabase refused (%s), keeping the email", async (code, status, message) => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("refused", status, code),
    });

    expect(await signIn({ email: " Angel@AceYourCourse.ph ", password: "pw" })).toEqual({
      error: message,
      fieldErrors: {},
      email: " Angel@AceYourCourse.ph ",
    });
  });

  it("says Supabase isn't answering on a network error", async () => {
    auth.signInWithPassword.mockRejectedValue(new TypeError("fetch failed"));

    expect(await signIn({ email: OWNER, password: "pw" })).toMatchObject({
      error: "Sign-in isn't answering right now. Try again in a minute.",
    });
  });

  it("says sign-in didn't finish when the Guard sees no session after it", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    expect(await signIn({ email: OWNER, password: "pw" })).toMatchObject({
      error: "Sign-in didn't finish. Try again.",
    });
    // The session Supabase set doesn't count here, so it ends.
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("says the email isn't confirmed when the Guard finds it unverified, ending the session", async () => {
    auth.signInWithPassword.mockImplementation(async () => {
      signedInAs(OWNER, "password");
      auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: "u1",
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            created_at: "",
            email: OWNER,
          },
        },
        error: null,
      });
      return { data: {}, error: null };
    });

    expect(await signIn({ email: OWNER, password: "pw" })).toMatchObject({
      error:
        "This email isn't confirmed. Confirm the User in the Supabase dashboard, then try again.",
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      { email: "", password: "" },
      { email: "Enter your email", password: "Enter your password" },
    ],
    [{ email: OWNER, password: "" }, { password: "Enter your password" }],
    [
      { email: "angel@", password: "pw" },
      { email: "Enter a valid email address, like name@example.com." },
    ],
  ])(
    "refuses %j next to each field, keeping the email and never asking Supabase",
    async (fields, fieldErrors) => {
      expect(await signIn(fields)).toEqual({ error: null, fieldErrors, email: fields.email });
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    },
  );

  it.each(["production", "test"])(
    "answers 404 in %s, whatever is posted, never asking Supabase",
    async (nodeEnv) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.resetModules();

      await expect(signIn({ email: OWNER, password: "right password" })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    },
  );
});

describe("switchAccount with the password box (ticket 19)", () => {
  it("signs out and returns to sign-in, where both ways are offered", async () => {
    underPnpmDev();
    googleProvider(false, true);
    const { switchAccount } = await import("../actions");

    await expect(switchAccount()).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in$/);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("goes to Google as before under pnpm dev when Email is off", async () => {
    underPnpmDev();
    googleProvider(true, false);
    const { switchAccount } = await import("../actions");

    await expect(switchAccount()).rejects.toThrow(`NEXT_REDIRECT ${GOOGLE}`);
  });
});
