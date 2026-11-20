import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE, hashDeviceToken } from "@/lib/member-app/device-token";
import { addTargetExam, getOrCreateMember, recordConsent } from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { ANDROID_CHROME, IPHONE_SAFARI } from "../../../test/member-inputs";

// The Active Device in the Member App's pages and Server Actions on sample
// data (Phase 3, ticket 04; stories 107–109, 133f). Each Member uses the
// Member App on one device at a time: signing in makes this device the Active
// Device, the old device's next request lands on "Session ended", and a
// session that never claimed this device (signed in through the Admin) gets
// "Use the Member App on this device". Each browser is a cookie jar: the
// tests swap jars to stand for two devices. The cookie jar, the request
// headers, redirect() and notFound() are the framework boundary, so they are
// replaced; the switch, the mode and the legal versions are as the server
// reads them.
const { jar, cookieOptions, userAgent, live, mode } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  cookieOptions: new Map<string, unknown>(),
  userAgent: { current: null as string | null },
  live: { current: false },
  mode: { current: "sample" as "sample" | "closed" },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string, options?: unknown) => {
      jar.set(name, value);
      cookieOptions.set(name, options);
    },
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () =>
    new Headers(userAgent.current === null ? {} : { "user-agent": userAgent.current }),
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

const TESTER = "tester@example.com";
const OWNER = "angel@aceyourcourse.ph";
const STRANGER = "stranger@example.com";
const SAMPLE_COOKIE = "ayc_admin_sample";

/** Matches the error redirect() throws for exactly this URL. */
const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const DEVICE_SCREEN = (next: string) => redirectsTo(`/app/device?next=${encodeURIComponent(next)}`);

/** A sample User who is already a Member, has agreed to the current versions and has ME as a Target Exam. */
async function agreed(email: string, name: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
  await addTargetExam(userId, { examCode: "ME", examDate: "2099-02-08" });
  return userId;
}

/** A browser: its own cookie jar, and its User-Agent. */
interface Browser {
  cookies: Map<string, string>;
  userAgent: string | null;
}
const browser = (ua: string | null = ANDROID_CHROME): Browser => ({
  cookies: new Map(),
  userAgent: ua,
});

/** Runs `work` in this browser: its cookies are the request's, and come back changed. */
async function on<T>(device: Browser, work: () => Promise<T>): Promise<T> {
  jar.clear();
  for (const [name, value] of device.cookies) jar.set(name, value);
  userAgent.current = device.userAgent;
  try {
    return await work();
  } finally {
    device.cookies = new Map(jar);
  }
}

/** Calls `work`, expecting it to redirect; gives the URL, or fails. */
async function redirectOf(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    const match = error instanceof Error ? /^NEXT_REDIRECT (.+)$/.exec(error.message) : null;
    if (match?.[1]) return match[1];
    throw error;
  }
  throw new Error("Expected a redirect");
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const home = async () =>
  (await import("./(shell)/(home)/page")).default({ searchParams: Promise.resolve({}) });
const shell = async (children: React.ReactNode) =>
  (await import("./(shell)/layout")).default({ children });
const devicePage = async (query: { next?: string; error?: string } = {}) =>
  (await import("./device/page")).default({ searchParams: Promise.resolve(query) });
const deviceTitle = async () => (await import("./device/page")).generateMetadata();
const signInAs = async (email: string, next = "/app") =>
  (await import("./sign-in/actions")).signInAs({ error: null, email: "" }, form({ email, next }));
const adminSignInAs = async (email: string) =>
  (await import("../admin/sign-in/actions")).signInAs(
    { error: null, email: "" },
    form({ email, next: "/admin" }),
  );
const confirmThisDevice = async (next = "/app") =>
  (await import("./device/actions")).confirmThisDevice(form({ next }));
const signInOnThisDevice = async (next = "/app") =>
  (await import("./device/actions")).signInOnThisDevice(form({ next }));
const signOut = async () => (await import("./actions")).signOut();
const changeExamDate = async () =>
  (await import("./(shell)/actions")).changeExamDate(
    { error: null, saved: false },
    form({ examCode: "ME", examDate: "2099-04-18" }),
  );

/** Signs in to the Member App in this browser, as the sample "Sign in as" does, and lands on `next`. */
async function signIn(device: Browser, email: string, next = "/app") {
  expect(await on(device, () => redirectOf(() => signInAs(email, next)))).toBe(next);
}

const switches = () => getSampleStore().memberDeviceSwitches;
const store = () => getSampleStore();

beforeEach(() => {
  jar.clear();
  cookieOptions.clear();
  userAgent.current = ANDROID_CHROME;
  live.current = false;
  mode.current = "sample";
  resetSampleStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signing in claims the device", () => {
  it("makes the device the Active Device, and the Member reaches Home", async () => {
    const userId = await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);

    await on(phone, async () => render(await home()));
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Bea" })).toBeInTheDocument();
    expect(switches()).toEqual([
      { userId, deviceLabel: "Chrome on Android", switchedAt: expect.any(String) },
    ]);
  });

  it("logs the first claim with its time and the device label", async () => {
    await agreed(TESTER, "Bea Tester");
    const before = Date.now();
    await signIn(browser(IPHONE_SAFARI), TESTER);

    const [first] = switches();
    expect(first?.deviceLabel).toBe("Safari on iOS");
    expect(new Date(first?.switchedAt ?? 0).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("labels a device whose User-Agent it can't tell “Unknown browser”", async () => {
    await agreed(TESTER, "Bea Tester");
    await signIn(browser(null), TESTER);
    expect(switches().map((entry) => entry.deviceLabel)).toEqual(["Unknown browser"]);
  });

  it("makes the Member record for someone the gate lets in for the first time, so the claim has an owner", async () => {
    await signIn(browser(), TESTER);
    expect(store().members).toMatchObject([{ email: TESTER }]);
    expect(switches()).toHaveLength(1);
  });

  it("claims nothing for someone the gate doesn't let in, and makes no Member record", async () => {
    const phone = browser();
    await signIn(phone, STRANGER);
    expect(phone.cookies.has(DEVICE_COOKIE)).toBe(false);
    expect(store().members).toEqual([]);
    expect(switches()).toEqual([]);
  });

  it("sets an httpOnly, SameSite=Lax cookie for /app, Secure outside local development", async () => {
    await agreed(TESTER, "Bea Tester");
    await signIn(browser(), TESTER);

    expect(cookieOptions.get(DEVICE_COOKIE)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/app",
      maxAge: 400 * 24 * 60 * 60,
    });
  });

  it("stores only the token's hash, and never logs the token", async () => {
    const log = vi.spyOn(console, "log");
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    const userId = await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);

    const token = phone.cookies.get(DEVICE_COOKIE) ?? "";
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(store().memberActiveDevices[userId]?.tokenHash).toBe(hashDeviceToken(token));
    expect(JSON.stringify(store())).not.toContain(token);
    for (const spy of [log, warn, error]) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(token);
    }
  });
});

describe("another device signing in", () => {
  it("sends device A to “Session ended” on its next request, naming the new device", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser(ANDROID_CHROME);
    const laptop = browser(IPHONE_SAFARI);
    await signIn(phone, TESTER);
    await signIn(laptop, TESTER);

    await on(phone, async () => {
      await expect(home()).rejects.toThrow(DEVICE_SCREEN("/app"));
      render(await devicePage({ next: "/app" }));
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "You were signed in on another device" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/NEW DEVICE · Safari on iOS · Today, \d{1,2}:\d{2}\s?[AP]M/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in on this device" })).toBeInTheDocument();

    await on(laptop, async () => render(await home()));
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Bea" })).toBeInTheDocument();
  });

  it("makes A active again with “Sign in on this device”, and B is then replaced", async () => {
    const userId = await agreed(TESTER, "Bea Tester");
    const phone = browser(ANDROID_CHROME);
    const laptop = browser(IPHONE_SAFARI);
    await signIn(phone, TESTER);
    await signIn(laptop, TESTER);

    expect(await on(phone, () => redirectOf(() => signInOnThisDevice("/app/account")))).toBe(
      "/app/account",
    );

    await on(phone, async () => render(await home()));
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Bea" })).toBeInTheDocument();
    await on(laptop, () => expect(home()).rejects.toThrow(DEVICE_SCREEN("/app")));
    expect(switches().filter((entry) => entry.userId === userId)).toHaveLength(3);
  });

  it("refuses a replaced device's Server Action posts, and changes nothing", async () => {
    const userId = await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    await signIn(browser(IPHONE_SAFARI), TESTER);
    const before = structuredClone(store().memberTargetExams[userId]);

    await on(phone, () => expect(changeExamDate()).rejects.toThrow(DEVICE_SCREEN("/app/account")));
    expect(store().memberTargetExams[userId]).toEqual(before);
  });

  it("refuses the one-tap claim on a replaced device: it must sign in again", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    await signIn(browser(IPHONE_SAFARI), TESTER);

    await on(phone, () => expect(confirmThisDevice("/app")).rejects.toThrow(DEVICE_SCREEN("/app")));
    expect(switches()).toHaveLength(2);
  });
});

describe("a session that never claimed this device", () => {
  /** The Owner, signed in through the Admin on this browser: the sample cookie, and no device token. */
  async function viaTheAdmin() {
    await agreed(OWNER, "Angel Rose L. Lepaña");
    const desk = browser(IPHONE_SAFARI);
    await on(desk, () => adminSignInAs(OWNER).catch(() => {}));
    return desk;
  }

  it("is sent from every page to “Use the Member App on this device”, coming back", async () => {
    const desk = await viaTheAdmin();
    expect(desk.cookies.get(SAMPLE_COOKIE)).toBe(OWNER);

    await on(desk, async () => {
      await expect(home()).rejects.toThrow(DEVICE_SCREEN("/app"));
      render(await devicePage({ next: "/app" }));
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Use the Member App on this device?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use the Member App on this device" }),
    ).toBeInTheDocument();
    expect(await on(desk, () => deviceTitle())).toEqual({ title: "Use this device" });
  });

  it("claims the device when the Member confirms, logging the claim, and goes on to next", async () => {
    const desk = await viaTheAdmin();

    expect(await on(desk, () => redirectOf(() => confirmThisDevice("/app/account")))).toBe(
      "/app/account",
    );
    expect(switches()).toMatchObject([{ deviceLabel: "Safari on iOS" }]);
    await on(desk, async () => render(await home()));
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Angel" })).toBeInTheDocument();
  });

  it("replaces the Member's other device when they confirm", async () => {
    await agreed(OWNER, "Angel Rose L. Lepaña");
    const phone = browser();
    await signIn(phone, OWNER);
    const desk = browser(IPHONE_SAFARI);
    await on(desk, () => adminSignInAs(OWNER).catch(() => {}));

    await on(desk, async () => render(await devicePage()));
    expect(screen.getByText(/ACTIVE NOW · Chrome on Android/)).toBeInTheDocument();

    await on(desk, () => redirectOf(() => confirmThisDevice()));
    await on(phone, () => expect(home()).rejects.toThrow(DEVICE_SCREEN("/app")));
  });

  it("is what someone gets who signed in while the gate refused them, once they're let in", async () => {
    const phone = browser();
    await signIn(phone, STRANGER);
    expect(phone.cookies.has(DEVICE_COOKIE)).toBe(false);

    live.current = true;
    await agreed(STRANGER, "Sam Stranger");
    await on(phone, () => expect(home()).rejects.toThrow(DEVICE_SCREEN("/app")));
    await on(phone, async () => render(await devicePage()));
    expect(
      screen.getByRole("heading", { level: 1, name: "Use the Member App on this device?" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ACTIVE NOW/)).not.toBeInTheDocument();
  });

  it("claims once when confirmed twice", async () => {
    const desk = await viaTheAdmin();
    await on(desk, () => redirectOf(() => confirmThisDevice()));
    await on(desk, () => redirectOf(() => confirmThisDevice()));
    expect(switches()).toHaveLength(1);
  });
});

describe("the Admin is exempt", () => {
  it("never replaces the Member App device: signing in to the Admin on another device claims nothing", async () => {
    await agreed(OWNER, "Angel Rose L. Lepaña");
    const phone = browser();
    await signIn(phone, OWNER);
    const desk = browser(IPHONE_SAFARI);

    await on(desk, () => adminSignInAs(OWNER).catch(() => {}));

    expect(desk.cookies.has(DEVICE_COOKIE)).toBe(false);
    expect(switches()).toHaveLength(1);
    await on(phone, async () => render(await home()));
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Angel" })).toBeInTheDocument();
  });

  it("never reads, sets or checks the device: nothing in the Admin uses the Active Device modules", () => {
    const roots = ["src/app/admin", "src/lib/admin", "src/components/admin"];
    const offenders = roots.flatMap((root) =>
      readdirSync(root, { recursive: true, encoding: "utf8" })
        .filter((file) => /\.tsx?$/.test(file))
        .filter((file) =>
          /@\/lib\/member-app\/device|ayc_device/.test(readFileSync(path.join(root, file), "utf8")),
        )
        .map((file) => path.join(root, file)),
    );
    expect(offenders).toEqual([]);
  });
});

describe("tampered and borrowed tokens", () => {
  it("treats a tampered token as replaced, never as active", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    const token = phone.cookies.get(DEVICE_COOKIE) ?? "";
    phone.cookies.set(DEVICE_COOKIE, `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`);

    await on(phone, async () => {
      await expect(home()).rejects.toThrow(DEVICE_SCREEN("/app"));
      render(await devicePage());
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "You were signed in on another device" }),
    ).toBeInTheDocument();
  });

  it("treats a token nobody issued as replaced", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    phone.cookies.set(DEVICE_COOKIE, "made-up");
    await on(phone, () => expect(home()).rejects.toThrow(DEVICE_SCREEN("/app")));
  });

  it("never matches one Member's token against another Member's Active Device", async () => {
    await agreed(TESTER, "Bea Tester");
    await agreed(OWNER, "Angel Rose L. Lepaña");
    const bea = browser();
    await signIn(bea, TESTER);
    await signIn(browser(IPHONE_SAFARI), OWNER);

    // The Owner signed in on Bea's browser, keeping Bea's token.
    const borrowed: Browser = {
      cookies: new Map([
        [DEVICE_COOKIE, bea.cookies.get(DEVICE_COOKIE) ?? ""],
        [SAMPLE_COOKIE, OWNER],
      ]),
      userAgent: ANDROID_CHROME,
    };
    await on(borrowed, () => expect(home()).rejects.toThrow(DEVICE_SCREEN("/app")));
  });
});

describe("the device screen", () => {
  it("sends an Active Device straight on to next", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    await on(phone, () =>
      expect(devicePage({ next: "/app/account" })).rejects.toThrow(redirectsTo("/app/account")),
    );
  });

  it("sends a signed-out visitor to sign-in, coming back to next", async () => {
    await expect(devicePage({ next: "/app/account" })).rejects.toThrow(
      redirectsTo("/app/sign-in?next=%2Fapp%2Faccount"),
    );
  });

  it("sends someone the gate doesn't let in to “Not open yet”", async () => {
    jar.set(SAMPLE_COOKIE, STRANGER);
    await expect(devicePage()).rejects.toThrow(redirectsTo("/app/not-open-yet"));
  });

  it("sends a Member who hasn't agreed to the consent screen first", async () => {
    await getOrCreateMember({ userId: sampleUserId(TESTER), email: TESTER, name: "Bea Tester" });
    jar.set(SAMPLE_COOKIE, TESTER);
    await expect(devicePage({ next: "/app/account" })).rejects.toThrow(
      redirectsTo("/app/consent?next=%2Fapp%2Faccount"),
    );
  });

  it("treats itself, and anywhere outside the Member App, as Home in next", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    for (const next of ["/app/device", "https://evil.example", "/admin"]) {
      await on(phone, () => expect(devicePage({ next })).rejects.toThrow(redirectsTo("/app")));
    }
  });

  it("is titled “Session ended” for a replaced device", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    await signIn(browser(IPHONE_SAFARI), TESTER);
    expect(await on(phone, () => deviceTitle())).toEqual({ title: "Session ended" });
  });

  it("says on “Session ended” why the last “Sign in on this device” didn't go on, ignoring an error it doesn't know", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    await signIn(browser(IPHONE_SAFARI), TESTER);

    const { unmount } = await on(phone, async () =>
      render(await devicePage({ next: "/app", error: "unreachable" })),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sign-in isn't answering right now. Try again in a minute.",
    );
    unmount();

    await on(phone, async () => render(await devicePage({ next: "/app", error: "<script>" })));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("answers 404 in closed mode", async () => {
    mode.current = "closed";
    jar.set(SAMPLE_COOKIE, TESTER);
    await expect(devicePage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the shell", () => {
  it("shows a replaced device no menu: the bare page, whose checks redirect", async () => {
    await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);
    await signIn(browser(IPHONE_SAFARI), TESTER);

    await on(phone, async () => render(await shell(<p>the screen</p>)));
    expect(screen.getByText("the screen")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows a session with no token no menu", async () => {
    await agreed(TESTER, "Bea Tester");
    jar.set(SAMPLE_COOKIE, TESTER);
    render(await shell(<p>the screen</p>));
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

describe("signing out of the Member App", () => {
  it("clears the device's cookie and keeps the Active Device record", async () => {
    const userId = await agreed(TESTER, "Bea Tester");
    const phone = browser();
    await signIn(phone, TESTER);

    expect(await on(phone, () => redirectOf(() => signOut()))).toBe("/app/sign-in");
    expect(phone.cookies.get(DEVICE_COOKIE) ?? "").toBe("");
    expect(cookieOptions.get(DEVICE_COOKIE)).toMatchObject({ path: "/app", maxAge: 0 });
    expect(store().memberActiveDevices[userId]).toMatchObject({ deviceLabel: "Chrome on Android" });
  });
});
