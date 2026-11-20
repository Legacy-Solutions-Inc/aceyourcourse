// Node caches React's JSX runtime the first time it loads, by the NODE_ENV of
// that moment, and the compiled pages call its development jsxDEV. Load it now,
// under Vitest's "test", before any test here stubs NODE_ENV "production".
import "react/jsx-dev-runtime";

import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { ANDROID_CHROME } from "../../../../test/member-inputs";

// The Member App's sign-in in live mode with the password box (ticket 20,
// temporary): while the site is tested, /app/sign-in offers the Admin's
// email and password box under "Continue with Google", exactly where the
// Admin offers it (ADMIN_PASSWORD_SIGN_IN "true" on a deployment, or
// `pnpm dev`, while Supabase has Email on). Signing in with it follows
// Google's callback: this device becomes the Active Device of someone the
// gate lets in, then the browser goes on to `next`. The Member App counts a
// session the way the Staff Guard does: Google everywhere, a password only
// where the box is allowed, nothing else.
//
// Supabase is the boundary: its server client's auth calls and the public
// settings it serves (fetch) are replaced. So are the framework's cookie jar,
// request headers, redirect() and notFound(). The staff list, the Beta Tester
// list and the Active Device are the sample ones, through the seams' sample
// arms. The mode is live unless a test says otherwise.
const { auth, jar, mode } = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    getClaims: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  jar: new Map<string, string>(),
  mode: { current: "live" as "live" | "sample" | "closed" },
}));

vi.mock("@/lib/admin/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/mode")>()),
  get adminMode() {
    return mode.current;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers({ "user-agent": ANDROID_CHROME }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/app",
}));

const TESTER = "tester@example.com";
const OWNER = "angel@aceyourcourse.ph";
const STRANGER = "stranger@example.com";
const RIGHT = "right password";

/** Each email's Supabase User id. */
const USER_IDS = {
  [TESTER]: "5b1c9e2a-0000-4000-8000-000000000001",
  [OWNER]: "5b1c9e2a-0000-4000-8000-000000000002",
  [STRANGER]: "5b1c9e2a-0000-4000-8000-000000000003",
} as const;
type Email = keyof typeof USER_IDS;
/** This email's Supabase User id: a known one, or another for anyone else. */
const userIdOf = (email: string): string =>
  Object.entries(USER_IDS).find(([known]) => known === email)?.[1] ??
  "5b1c9e2a-0000-4000-8000-000000000099";

const IDLE = { error: null, fieldErrors: {}, email: "" };
const MISMATCH = "That email and password don't match.";
const UNCONFIRMED =
  "This email isn't confirmed. Confirm the User in the Supabase dashboard, then try again.";
const DID_NOT_FINISH = "Sign-in didn't finish. Try again.";
const GOOGLE_ONLY_LINE = "Use your Google account. No separate username or password.";

/** Matches the error redirect() throws for exactly this URL. */
const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const NOT_OPEN_YET = redirectsTo("/app/not-open-yet");

/**
 * The session the cookies carry: this email's Supabase User (null: signed
 * out), signed in by `method`, its email confirmed unless said.
 */
function signedInAs(email: string | null, method: unknown = "oauth", confirmed = true) {
  const id = email ? userIdOf(email) : null;
  auth.getClaims.mockResolvedValue(
    email
      ? { data: { claims: { sub: id, amr: [{ method, timestamp: 0 }] } }, error: null }
      : { data: null, error: null },
  );
  const user =
    email && id
      ? ({
          id,
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: "2026-11-20T00:00:00Z",
          email,
          ...(confirmed ? { email_confirmed_at: "2026-11-20T00:00:00Z" } : {}),
        } satisfies User)
      : null;
  auth.getUser.mockResolvedValue({ data: { user }, error: null });
}

/**
 * Supabase signs in by password: these emails, with the right password, start
 * a session made by `method` (password, unless said); anything else is
 * refused as Supabase refuses a wrong email or password.
 */
function passwordUsers(emails: string[], { method = "password", confirmed = true } = {}) {
  auth.signInWithPassword.mockImplementation(
    async (credentials: { email: string; password: string }) => {
      if (!emails.includes(credentials.email) || credentials.password !== RIGHT) {
        const { AuthApiError } = await import("@supabase/supabase-js");
        return {
          data: { user: null, session: null },
          error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
        };
      }
      signedInAs(credentials.email, method, confirmed);
      return { data: {}, error: null };
    },
  );
}

/** Supabase's public auth settings: Google on, and Email on unless said. */
function providers(email = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ external: { google: true, email } })),
  );
}

/** Loads the modules as this NODE_ENV runs them, with the switch set ("" leaves it unset). */
function serverWith(nodeEnv: "production" | "development", passwordSwitch: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("ADMIN_PASSWORD_SIGN_IN", passwordSwitch);
  vi.resetModules();
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const signInPage = async (query: { next?: string } = {}) =>
  (await import("./page")).default({ searchParams: Promise.resolve(query) });
const home = async () =>
  (await import("../(shell)/(home)/page")).default({ searchParams: Promise.resolve({}) });
async function signInWithPassword(fields: Record<string, string>) {
  const { signInWithPassword: action } = await import("./actions");
  return action(IDLE, form(fields));
}
const access = async () => (await import("@/lib/member-app/guard")).getMemberAppAccess();

const box = (label: "Testing only" | "Development only") =>
  screen.queryByRole("region", { name: label });
const member = (email: string) => getSampleStore().members.find((m) => m.email === email);
const activeDevice = (email: Email) => getSampleStore().memberActiveDevices[USER_IDS[email]];

beforeEach(() => {
  jar.clear();
  mode.current = "live";
  resetSampleStore();
  signedInAs(null);
  providers();
  // React logs a production build's warnings to console.error; they aren't under test.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000/");
  vi.stubEnv("MEMBER_APP_LIVE", "false");
  serverWith("production", "true");
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the Member App's sign-in screen with the password box (ticket 20)", () => {
  it("shows the box under Continue with Google, headed TESTING ONLY, on a deployment with the switch true", async () => {
    render(await signInPage({ next: "/app/library" }));

    const google = screen.getByRole("button", { name: "Continue with Google" });
    const testing = screen.getByRole("region", { name: "Testing only" });
    expect(google.compareDocumentPosition(testing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("TESTING ONLY")).toBeVisible();
    expect(screen.queryByText("DEVELOPMENT ONLY")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(testing.querySelector<HTMLInputElement>('input[name="next"]')?.value).toBe(
      "/app/library",
    );
  });

  it("says Google is the usual way and the box is for testing", async () => {
    render(await signInPage());

    expect(
      screen.getByText(
        "Google is the usual way to sign in. The password sign-in below is for testing only.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(GOOGLE_ONLY_LINE)).not.toBeInTheDocument();
  });

  it.each(["true", "false", ""])(
    "shows it headed DEVELOPMENT ONLY under pnpm dev, with the switch %j",
    async (passwordSwitch) => {
      serverWith("development", passwordSwitch);
      render(await signInPage());

      expect(box("Development only")).toBeInTheDocument();
      expect(screen.getByText("DEVELOPMENT ONLY")).toBeVisible();
      expect(box("Testing only")).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Google is the usual way to sign in. The password sign-in below is for development only.",
        ),
      ).toBeInTheDocument();
    },
  );

  it.each(["false", ""])(
    "is exactly as before on a deployment with the switch %j, even with Email on",
    async (passwordSwitch) => {
      serverWith("production", passwordSwitch);
      render(await signInPage());

      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
      expect(screen.getByText(GOOGLE_ONLY_LINE)).toBeInTheDocument();
      expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
      expect(box("Testing only")).not.toBeInTheDocument();
      expect(box("Development only")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["Email is off", () => providers(false)],
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
  ])("has no box with the switch true when %s", async (_label, settings) => {
    settings();
    render(await signInPage());

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByText(GOOGLE_ONLY_LINE)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("has no box in sample mode, whatever the switch says: Sign in as stands in for Google", async () => {
    mode.current = "sample";
    serverWith("development", "true");
    render(await signInPage());

    expect(screen.getByText(GOOGLE_ONLY_LINE)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(box("Development only")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["https://evil.example", "//evil.example", "/admin", "/app/../admin"])(
    "sends the box back to Home for the unsafe next %j",
    async (next) => {
      render(await signInPage({ next }));

      expect(
        box("Testing only")?.querySelector<HTMLInputElement>('input[name="next"]')?.value,
      ).toBe("/app");
    },
  );
});

describe("signInWithPassword, the Member App's password box (ticket 20)", () => {
  beforeEach(() => {
    passwordUsers([TESTER, OWNER, STRANGER]);
  });

  it("signs a Beta Tester in, makes this device their Active Device, and goes to next", async () => {
    await expect(
      signInWithPassword({ email: TESTER, password: RIGHT, next: "/app/library" }),
    ).rejects.toThrow(redirectsTo("/app/library"));

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: TESTER, password: RIGHT });
    expect(member(TESTER)).toMatchObject({ userId: USER_IDS[TESTER], email: TESTER });
    expect(activeDevice(TESTER)).toMatchObject({ deviceLabel: "Chrome on Android" });
    expect(jar.get(DEVICE_COOKIE)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await access()).toMatchObject({ status: "open", user: { email: TESTER } });
  });

  it("signs a Staff User in the same way", async () => {
    await expect(signInWithPassword({ email: OWNER, password: RIGHT })).rejects.toThrow(
      redirectsTo("/app"),
    );

    expect(activeDevice(OWNER)).not.toBeUndefined();
    expect(await access()).toMatchObject({ status: "open", user: { email: OWNER } });
  });

  it("signs in under pnpm dev whatever the switch says", async () => {
    serverWith("development", "false");

    await expect(signInWithPassword({ email: TESTER, password: RIGHT })).rejects.toThrow(
      redirectsTo("/app"),
    );
    expect(activeDevice(TESTER)).not.toBeUndefined();
  });

  it("sends someone who isn't Staff or a Beta Tester on to “Not open yet”, claiming no device", async () => {
    await expect(signInWithPassword({ email: STRANGER, password: RIGHT })).rejects.toThrow(
      redirectsTo("/app"),
    );

    expect(member(STRANGER)).toBeUndefined();
    expect(getSampleStore().memberActiveDevices).toEqual({});
    expect(jar.has(DEVICE_COOKIE)).toBe(false);
    await expect(home()).rejects.toThrow(NOT_OPEN_YET);
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/admin", "/app/../admin"])(
    "goes to Home instead of the unsafe next %j",
    async (next) => {
      await expect(signInWithPassword({ email: TESTER, password: RIGHT, next })).rejects.toThrow(
        redirectsTo("/app"),
      );
    },
  );

  it.each([
    ["a wrong password", { email: TESTER, password: "wrong secret" }],
    ["an unknown email", { email: "nobody@example.com", password: RIGHT }],
  ])("says the email and password don't match for %s, keeping the email", async (_l, fields) => {
    const state = await signInWithPassword(fields);

    expect(state).toEqual({ error: MISMATCH, fieldErrors: {}, email: fields.email });
    expect(JSON.stringify(state)).not.toContain(fields.password);
    expect(getSampleStore().memberActiveDevices).toEqual({});
  });

  it("refuses an email Supabase says isn't confirmed", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("Email not confirmed", 400, "email_not_confirmed"),
    });

    expect(await signInWithPassword({ email: TESTER, password: RIGHT })).toEqual({
      error: UNCONFIRMED,
      fieldErrors: {},
      email: TESTER,
    });
    expect(getSampleStore().memberActiveDevices).toEqual({});
  });

  it("refuses a session whose email isn't confirmed, ending it and claiming no device", async () => {
    passwordUsers([TESTER], { confirmed: false });

    expect(await signInWithPassword({ email: TESTER, password: RIGHT })).toEqual({
      error: UNCONFIRMED,
      fieldErrors: {},
      email: TESTER,
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(getSampleStore().memberActiveDevices).toEqual({});
  });

  it.each(["otp", "magiclink", "anonymous"])(
    "ends a session made by %s, which the Member App doesn't count, claiming no device",
    async (method) => {
      passwordUsers([TESTER], { method });

      expect(await signInWithPassword({ email: TESTER, password: RIGHT })).toEqual({
        error: DID_NOT_FINISH,
        fieldErrors: {},
        email: TESTER,
      });
      expect(auth.signOut).toHaveBeenCalledTimes(1);
      expect(getSampleStore().memberActiveDevices).toEqual({});
    },
  );

  it("ends the session and says sign-in didn't finish when no session follows", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    expect(await signInWithPassword({ email: TESTER, password: RIGHT })).toMatchObject({
      error: DID_NOT_FINISH,
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("says Supabase isn't answering on a network error", async () => {
    auth.signInWithPassword.mockRejectedValue(new TypeError("fetch failed"));

    expect(await signInWithPassword({ email: TESTER, password: RIGHT })).toMatchObject({
      error: "Sign-in isn't answering right now. Try again in a minute.",
    });
  });

  it.each([
    [
      { email: "", password: "" },
      { email: "Enter your email", password: "Enter your password" },
    ],
    [{ email: TESTER, password: "" }, { password: "Enter your password" }],
    [
      { email: "tester@", password: "pw" },
      { email: "Enter a valid email address, like name@example.com." },
    ],
  ])(
    "refuses %j next to each field, keeping the email and never asking Supabase",
    async (fields, fieldErrors) => {
      expect(await signInWithPassword(fields)).toEqual({
        error: null,
        fieldErrors,
        email: fields.email,
      });
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    },
  );

  it.each(["false", ""])(
    "answers 404 on a deployment with the switch %j, whatever is posted, never asking Supabase",
    async (passwordSwitch) => {
      serverWith("production", passwordSwitch);

      await expect(signInWithPassword({ email: TESTER, password: RIGHT })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    },
  );

  it.each(["sample", "closed"] as const)(
    "answers 404 in %s mode, whatever the switch says, never asking Supabase",
    async (adminMode) => {
      mode.current = adminMode;
      serverWith("development", "true");

      await expect(signInWithPassword({ email: TESTER, password: RIGHT })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
      expect(jar.size).toBe(0);
    },
  );
});

describe("which sessions count in /app (ticket 20)", () => {
  it.each(["false", ""])(
    "treats a password session made elsewhere as signed out on a deployment with the switch %j",
    async (passwordSwitch) => {
      serverWith("production", passwordSwitch);
      signedInAs(TESTER, "password");

      expect(await access()).toEqual({ status: "signed-out" });
      await expect(home()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp"));
    },
  );

  it("counts a password session on a deployment with the switch true", async () => {
    signedInAs(TESTER, "password");

    expect(await access()).toMatchObject({ status: "open", user: { email: TESTER } });
  });

  it.each(["true", "false"])("counts a Google session with the switch %j", async (value) => {
    serverWith("production", value);
    signedInAs(TESTER, "oauth");

    expect(await access()).toMatchObject({ status: "open", user: { email: TESTER } });
  });

  it.each([
    ["true", "magiclink"],
    ["true", "otp"],
    ["true", "anonymous"],
    ["true", null],
    ["true", 7],
    ["false", "magiclink"],
    ["false", "otp"],
    ["false", "anonymous"],
  ])("never counts a session with the switch %j made by %j", async (value, method) => {
    serverWith("production", value);
    signedInAs(TESTER, method);

    expect(await access()).toEqual({ status: "signed-out" });
  });

  it.each([
    ["missing", undefined],
    ["empty", []],
    ["not a list", "password"],
  ])("never counts a session whose amr is %s", async (_label, amr) => {
    signedInAs(TESTER);
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_IDS[TESTER], amr } },
      error: null,
    });

    expect(await access()).toEqual({ status: "signed-out" });
  });
});
