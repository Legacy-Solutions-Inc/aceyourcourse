import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// The sign-in screen and its actions in live mode (ticket 16): "Continue with
// Google" starts Google's sign-in, with no "Sign in as" list. Staff already
// signed in go straight on. Supabase is the boundary: its server client's
// auth calls and the public settings it serves (fetch) are replaced. The
// staff list is the sample one, through the Admin seam's sample arm.
const { auth, jar } = vi.hoisted(() => ({
  auth: { getUser: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn() },
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

function signedInAs(email: string | null) {
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

/** Supabase's public auth settings, with Google on or off. */
function googleProvider(enabled: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ external: { google: enabled, email: false } })),
  );
}

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
