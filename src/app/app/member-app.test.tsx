import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { removeBetaTester } from "@/services/admin.mock";
import { addTargetExam, getOrCreateMember, recordConsent } from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";

// The Member App's pages and Server Actions on sample data (Phase 3, tickets
// 01 and 02), each called as a browser would reach it, by everyone the gate
// and consent must turn away: signed out goes to the sign-in screen, someone
// signed in who is neither Staff nor a Beta Tester goes to "Not open yet",
// with no Member record made, and a Member who hasn't agreed to the current
// Terms and Privacy Policy goes to the consent screen (its own tests are in
// consent/consent.test.tsx). Onboarding and Target Exams are in
// target-exams.test.tsx: the Members here have one already. The cookie jar, redirect() and notFound() are the
// framework boundary, so they are replaced; the switch, the mode and the
// current legal versions are as the server would read them, and a test can
// change any of them.
const { jar, live, mode, legal } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  live: { current: false },
  mode: { current: "sample" as "sample" | "closed" },
  legal: { current: { terms: "2.0", privacy: "2.0" } },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
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
  usePathname: () => "/app",
}));
vi.mock("@/services/catalogue.rules", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/catalogue.rules")>()),
  memberAppLive: () => live.current,
}));
vi.mock("@/lib/admin/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/mode")>()),
  get adminMode() {
    return mode.current;
  },
}));
vi.mock("@/content/legal/documents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/content/legal/documents")>()),
  currentLegalVersions: () => ({ ...legal.current }),
}));

const OWNER = sampleActor("owner");
const TESTER = "tester@example.com";
const STRANGER = "stranger@example.com";
const COOKIE = "ayc_admin_sample";

const signedInAs = (email: string) => jar.set(COOKIE, email);
/** Matches the error redirect() throws for exactly this URL. */
const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const NOT_OPEN_YET = redirectsTo("/app/not-open-yet");
const members = () => getSampleStore().members;
const consents = () => getSampleStore().memberConsents;

/**
 * A sample User, already a Member under this name, having agreed to these
 * versions (the current ones unless given), with ME as their Target Exam.
 */
async function agreedAs(email: string, name: string, termsVersion = "2.0", privacyVersion = "2.0") {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, { termsVersion, privacyVersion });
  await addTargetExam(userId, { examCode: "ME", examDate: "2099-02-08" });
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const home = async () =>
  (await import("./(shell)/page")).default({ searchParams: Promise.resolve({}) });
const account = async () => (await import("./(shell)/account/page")).default();
const addExamPage = async () => (await import("./(shell)/add-exam/page")).default();
const comingSoon = async (segment: string) =>
  (await import("./(shell)/[screen]/page")).default({
    params: Promise.resolve({ screen: segment }),
  });
const shell = async (children: React.ReactNode) =>
  (await import("./(shell)/layout")).default({ children });
const signInPage = async (query: { next?: string; error?: string } = {}) =>
  (await import("./sign-in/page")).default({ searchParams: Promise.resolve(query) });
const notOpenYetPage = async () => (await import("./not-open-yet/page")).default();
const signInAs = async (fields: Record<string, string>) =>
  (await import("./sign-in/actions")).signInAs({ error: null, email: "" }, form(fields));

/** Every /app page behind the gate, by its address. */
const GATED_PAGES: [string, () => Promise<unknown>][] = [
  ["/app", home],
  ["/app/library", () => comingSoon("library")],
  ["/app/courses", () => comingSoon("courses")],
  ["/app/plans", () => comingSoon("plans")],
  ["/app/billing", () => comingSoon("billing")],
  ["/app/account", account],
  ["/app/add-exam", addExamPage],
  ["/app/support", () => comingSoon("support")],
  ["/app/nonsense", () => comingSoon("nonsense")],
];

beforeEach(() => {
  jar.clear();
  live.current = false;
  mode.current = "sample";
  legal.current = { terms: "2.0", privacy: "2.0" };
  resetSampleStore();
});

describe("every gated /app page", () => {
  it.each(GATED_PAGES)(
    "%s sends a signed-out visitor to the sign-in screen, coming back",
    async (path, page) => {
      await expect(page()).rejects.toThrow(
        redirectsTo(`/app/sign-in?next=${encodeURIComponent(path)}`),
      );
    },
  );

  it.each(GATED_PAGES)(
    "%s refuses someone the gate doesn't let in, and makes no Member record",
    async (_path, page) => {
      signedInAs(STRANGER);
      await expect(page()).rejects.toThrow(NOT_OPEN_YET);
      expect(members()).toEqual([]);
    },
  );

  it.each(GATED_PAGES)("%s refuses a removed tester at their next request", async (_path, page) => {
    signedInAs(TESTER);
    await removeBetaTester(OWNER, TESTER);
    await expect(page()).rejects.toThrow(NOT_OPEN_YET);
  });

  it.each(GATED_PAGES)("%s answers 404 in closed mode", async (_path, page) => {
    mode.current = "closed";
    signedInAs(TESTER);
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each(GATED_PAGES)(
    "%s sends a Member who has never agreed to the consent screen, coming back, with nothing agreed",
    async (path, page) => {
      signedInAs(TESTER);
      await expect(page()).rejects.toThrow(
        redirectsTo(`/app/consent?next=${encodeURIComponent(path)}`),
      );
      expect(members()).toMatchObject([{ email: TESTER }]);
      expect(consents()).toEqual([]);
    },
  );

  it.each(GATED_PAGES)(
    "%s sends a Member who agreed to an old Privacy version to the consent screen",
    async (path, page) => {
      await agreedAs(TESTER, "Bea Tester", "2.0", "1.0");
      signedInAs(TESTER);
      await expect(page()).rejects.toThrow(
        redirectsTo(`/app/consent?next=${encodeURIComponent(path)}`),
      );
    },
  );

  it("sends every Member to the consent screen again once a version changes", async () => {
    await agreedAs(TESTER, "Bea Tester");
    await agreedAs(OWNER.email, OWNER.name);
    legal.current = { terms: "2.1", privacy: "2.0" };

    for (const email of [TESTER, OWNER.email]) {
      signedInAs(email);
      await expect(home()).rejects.toThrow(redirectsTo("/app/consent?next=%2Fapp"));
    }
  });
});

describe("Home", () => {
  it("welcomes a Beta Tester who has agreed, by their first name", async () => {
    await agreedAs(TESTER, "Bea Tester");
    signedInAs(TESTER);
    render(await home());

    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Bea" })).toBeInTheDocument();
    expect(members()).toMatchObject([{ email: TESTER, name: "Bea Tester" }]);
  });

  it("welcomes an active Staff User who has agreed", async () => {
    await agreedAs(OWNER.email, OWNER.name);
    signedInAs(OWNER.email);
    render(await home());
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Angel" })).toBeInTheDocument();
  });

  it("welcomes anyone who has agreed once the switch is on", async () => {
    live.current = true;
    await agreedAs(STRANGER, "Sam Stranger");
    signedInAs(STRANGER);
    render(await home());
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Sam" })).toBeInTheDocument();
  });
});

describe("the screens that aren't built yet", () => {
  it.each([
    ["library", "02 · LIBRARY"],
    ["courses", "03 · COURSES"],
    ["plans", "04 · PLANS"],
    ["billing", "05 · BILLING"],
    ["support", "07 · SUPPORT"],
  ])("/app/%s says it's coming in the beta", async (segment, eyebrow) => {
    await agreedAs(TESTER, "Bea Tester");
    signedInAs(TESTER);
    render(await comingSoon(segment));

    expect(
      screen.getByRole("heading", { level: 1, name: "Coming in the beta" }),
    ).toBeInTheDocument();
    expect(screen.getByText(eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/app");
  });

  it("answers 404 for an address that is no screen, once the gate and consent let the Member in", async () => {
    await agreedAs(TESTER, "Bea Tester");
    signedInAs(TESTER);
    await expect(comingSoon("nonsense")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the shell", () => {
  it("wraps a Member's screen in the sidebar and the Menu button", async () => {
    await agreedAs(TESTER, "Bea Tester");
    signedInAs(TESTER);
    render(await shell(<p>the screen</p>));

    expect(screen.getByText("the screen")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Member App" });
    expect(within(nav).getAllByRole("link")).toHaveLength(7);
    expect(within(nav).getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Bea Tester")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });

  it.each([
    ["a signed-out visitor", null],
    ["someone the gate doesn't let in", STRANGER],
    ["a Member who hasn't agreed yet", TESTER],
  ])("shows %s no menu: the bare page, whose checks redirect", async (_who, email) => {
    if (email) signedInAs(email);
    render(await shell(<p>the screen</p>));

    expect(screen.getByText("the screen")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
    expect(members()).toEqual([]);
    expect(consents()).toEqual([]);
  });

  it("shows a Member whose agreement is out of date no menu", async () => {
    await agreedAs(TESTER, "Bea Tester", "1.0", "2.0");
    signedInAs(TESTER);
    render(await shell(<p>the screen</p>));
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

describe("the sign-in screen", () => {
  it("shows the mockup's copy, with the three sample Members behind Continue with Google", async () => {
    const user = userEvent.setup();
    render(await signInPage({ next: "/app/library" }));

    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByText("Use your Google account. No separate username or password."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    const region = screen.getByRole("region", { name: "Sign in as" });
    expect(
      within(region)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Bea Testertester@example.com · Beta Tester",
      "Angel Rose L. Lepañaangel@aceyourcourse.ph · Owner",
      "Sam Strangerstranger@example.com · Not a Beta Tester · sees “Not open yet”",
    ]);
    for (const input of region.querySelectorAll<HTMLInputElement>('input[name="next"]')) {
      expect(input.value).toBe("/app/library");
    }
  });

  it.each([
    "https://evil.example",
    "//x",
    "/\\x",
    "/admin/products",
    "/application",
    "/app/../admin",
  ])("sends back the unsafe next %j as Home", async (next) => {
    render(await signInPage({ next }));
    const inputs = document.querySelectorAll<HTMLInputElement>('input[name="next"]');
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input.value).toBe("/app");
  });

  it("says why the last sign-in didn't go on", async () => {
    render(await signInPage({ error: "unverified" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This Google account's email address isn't verified, so it can't sign in.",
    );
  });

  it("ignores an error it doesn't know", async () => {
    render(await signInPage({ error: "<script>" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends a Member who is already signed in straight on to next", async () => {
    signedInAs(TESTER);
    await expect(signInPage({ next: "/app/library" })).rejects.toThrow(redirectsTo("/app/library"));
  });

  it("sends someone signed in whom the gate doesn't let in to “Not open yet”", async () => {
    signedInAs(STRANGER);
    await expect(signInPage()).rejects.toThrow(NOT_OPEN_YET);
  });

  it("answers 404 in closed mode, so “Sign in as” is absent", async () => {
    mode.current = "closed";
    await expect(signInPage()).rejects.toThrow("NEXT_NOT_FOUND");
    const { listSampleMembers } = await import("@/lib/admin/identity");
    expect(listSampleMembers()).toEqual([]);
  });
});

describe("“Not open yet”", () => {
  it("keeps the User signed in, with the support email from Settings and Sign out", async () => {
    signedInAs(STRANGER);
    render(await notOpenYetPage());

    expect(screen.getByRole("heading", { level: 1, name: "Not open yet" })).toBeInTheDocument();
    expect(screen.getByText(STRANGER)).toBeInTheDocument();
    const { contactEmail } = getSampleStore().catalogue.settings;
    expect(screen.getByRole("link", { name: contactEmail })).toHaveAttribute(
      "href",
      `mailto:${contactEmail}`,
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(jar.get(COOKIE)).toBe(STRANGER);
    expect(members()).toEqual([]);
  });

  it("sends a signed-out visitor to the sign-in screen", async () => {
    await expect(notOpenYetPage()).rejects.toThrow(redirectsTo("/app/sign-in"));
  });

  it("sends someone the gate now lets in to Home", async () => {
    signedInAs(TESTER);
    await expect(notOpenYetPage()).rejects.toThrow(redirectsTo("/app"));
  });

  it("sends anyone to Home once the switch is on", async () => {
    live.current = true;
    signedInAs(STRANGER);
    await expect(notOpenYetPage()).rejects.toThrow(redirectsTo("/app"));
  });

  it("answers 404 in closed mode", async () => {
    mode.current = "closed";
    signedInAs(STRANGER);
    await expect(notOpenYetPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the Member App's Server Actions", () => {
  describe("signInAs (sample mode)", () => {
    it("signs in as a sample Member and goes to next, making no Member record itself", async () => {
      await expect(signInAs({ email: TESTER, next: "/app/library" })).rejects.toThrow(
        redirectsTo("/app/library"),
      );
      expect(jar.get(COOKIE)).toBe(TESTER);
      expect(members()).toEqual([]);
    });

    it("signs in any email, lowercased: the gate on the next page decides", async () => {
      await expect(signInAs({ email: " Stranger@Example.com ", next: "/app" })).rejects.toThrow(
        redirectsTo("/app"),
      );
      expect(jar.get(COOKIE)).toBe(STRANGER);
      await expect(home()).rejects.toThrow(NOT_OPEN_YET);
    });

    it.each([
      "https://evil.example",
      "//x",
      "/\\x",
      "..",
      "/admin",
      "/admin/../app",
      "/application",
      "",
    ])("goes to Home instead of next=%j", async (next) => {
      await expect(signInAs({ email: TESTER, next })).rejects.toThrow(redirectsTo("/app"));
    });

    it.each([
      ["", "Enter an email address."],
      ["not-an-email", "Enter a valid email address, like name@example.com."],
    ])("refuses the email %j with a message, and signs nobody in", async (email, error) => {
      expect(await signInAs({ email, next: "/app" })).toEqual({ error, email });
      expect(jar.has(COOKIE)).toBe(false);
    });

    it("answers 404 in closed mode, and signs nobody in", async () => {
      mode.current = "closed";
      await expect(signInAs({ email: TESTER, next: "/app" })).rejects.toThrow("NEXT_NOT_FOUND");
      expect(jar.has(COOKIE)).toBe(false);
    });
  });

  describe("continueWithGoogle", () => {
    it("answers 404 outside live mode", async () => {
      const { continueWithGoogle } = await import("./sign-in/actions");
      await expect(continueWithGoogle(form({ next: "/app" }))).rejects.toThrow("NEXT_NOT_FOUND");
      mode.current = "closed";
      await expect(continueWithGoogle(form({ next: "/app" }))).rejects.toThrow("NEXT_NOT_FOUND");
    });
  });

  describe("signOut", () => {
    it("ends the session and returns to the sign-in screen", async () => {
      signedInAs(TESTER);
      const { signOut } = await import("./actions");

      await expect(signOut()).rejects.toThrow(redirectsTo("/app/sign-in"));
      expect(jar.has(COOKIE)).toBe(false);
      await expect(home()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp"));
    });

    it("signs out someone the gate doesn't let in, too", async () => {
      signedInAs(STRANGER);
      const { signOut } = await import("./actions");

      await expect(signOut()).rejects.toThrow(redirectsTo("/app/sign-in"));
      expect(jar.has(COOKIE)).toBe(false);
    });

    it("answers 404 in closed mode", async () => {
      mode.current = "closed";
      const { signOut } = await import("./actions");
      await expect(signOut()).rejects.toThrow("NEXT_NOT_FOUND");
    });
  });
});
