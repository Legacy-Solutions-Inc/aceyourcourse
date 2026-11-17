import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOrCreateMember, recordConsent } from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// The consent screen and its Server Action on sample data (Phase 3, ticket
// 02; spec, Phase 3 → Consent; stories 82, 83, 133e), each called as a
// browser would reach it. They sit behind the gate but before consent: the
// gate turns away who it always does, and the action refuses on the server
// whatever the browser sends. The cookie jar, redirect() and notFound() are
// the framework boundary, so they are replaced; the switch, the mode and the
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

const TESTER = "tester@example.com";
const STRANGER = "stranger@example.com";
const OTHER = "late.joiner@example.com";
const COOKIE = "ayc_admin_sample";
const BOOT = new Date("2026-11-17T03:42:00.000Z");

const signedInAs = (email: string) => jar.set(COOKIE, email);
/** Matches the error redirect() throws for exactly this URL. */
const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const NOT_OPEN_YET = redirectsTo("/app/not-open-yet");
const members = () => getSampleStore().members;
const consents = () => getSampleStore().memberConsents;

/** A sample User, already a Member, having agreed to these versions. */
async function agreedAs(email: string, termsVersion: string, privacyVersion: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name: null });
  return recordConsent(userId, { termsVersion, privacyVersion });
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** What the screen sends when both boxes are ticked, with the versions it showed. */
const BOTH = { terms: "agreed", privacy: "agreed", termsVersion: "2.0", privacyVersion: "2.0" };

const consentPage = async (query: { next?: string; outdated?: string } = {}) =>
  (await import("./page")).default({ searchParams: Promise.resolve(query) });
const agree = async (fields: Record<string, string>) =>
  (await import("./actions")).agreeAndContinue({ error: null }, form(fields));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  live.current = false;
  mode.current = "sample";
  legal.current = { terms: "2.0", privacy: "2.0" };
  resetSampleStore();
  return () => vi.useRealTimers();
});

describe("the consent screen", () => {
  it("shows a new Member what's kept and why, both boxes unchecked, Agree disabled", async () => {
    signedInAs(TESTER);
    render(await consentPage({ next: "/app/library" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "What we keep, and why" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Terms of Use/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Privacy Policy/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Agree and continue" })).toBeDisabled();
    // The gate let them in, so they're a Member, and nothing is agreed yet.
    expect(members()).toMatchObject([{ email: TESTER }]);
    expect(consents()).toEqual([]);
  });

  it("sends back the current versions and the sanitised next with the form", async () => {
    legal.current = { terms: "2.0", privacy: "2.1" };
    signedInAs(TESTER);
    render(await consentPage({ next: "/app/library" }));

    const value = (name: string) =>
      document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
    expect(value("termsVersion")).toBe("2.0");
    expect(value("privacyVersion")).toBe("2.1");
    expect(value("next")).toBe("/app/library");
  });

  it.each(["https://evil.example", "//x", "/admin", "/app/consent", "/app/../admin"])(
    "sends back the unsafe next %j as Home",
    async (next) => {
      signedInAs(TESTER);
      render(await consentPage({ next }));
      expect(document.querySelector<HTMLInputElement>('input[name="next"]')?.value).toBe("/app");
    },
  );

  it.each([
    ["only the Terms", "1.0", "2.0", "We’ve updated our Terms"],
    ["only the Privacy Policy", "2.0", "1.0", "We’ve updated our Privacy Policy"],
    ["both", "1.0", "1.0", "We’ve updated our Terms and Privacy Policy"],
  ])(
    "names what changed for a Member who agreed to an old version of %s",
    async (_label, termsVersion, privacyVersion, heading) => {
      await agreedAs(TESTER, termsVersion, privacyVersion);
      signedInAs(TESTER);
      render(await consentPage());

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        new RegExp(`^${heading}$`),
      );
    },
  );

  it("says the documents changed while it was open, when it reloads after an out-of-date send", async () => {
    signedInAs(TESTER);
    render(await consentPage({ outdated: "1" }));
    expect(screen.getByRole("status")).toHaveTextContent(/changed while this page was open/);
  });

  it("sends a Member who has agreed to the current versions straight on to next", async () => {
    await agreedAs(TESTER, "2.0", "2.0");
    signedInAs(TESTER);
    await expect(consentPage({ next: "/app/library" })).rejects.toThrow(
      redirectsTo("/app/library"),
    );
  });

  it("sends a signed-out visitor to the sign-in screen, coming back to where they were going", async () => {
    await expect(consentPage({ next: "/app/library" })).rejects.toThrow(
      redirectsTo("/app/sign-in?next=%2Fapp%2Flibrary"),
    );
  });

  it("sends someone the gate doesn't let in to “Not open yet”, with no Member or consent record", async () => {
    signedInAs(STRANGER);
    await expect(consentPage()).rejects.toThrow(NOT_OPEN_YET);
    expect(members()).toEqual([]);
    expect(consents()).toEqual([]);
  });

  it("answers 404 in closed mode", async () => {
    mode.current = "closed";
    signedInAs(TESTER);
    await expect(consentPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("agreeAndContinue", () => {
  it("stores both versions and the time for the signed-in Member, then continues to next", async () => {
    signedInAs(TESTER);
    await expect(agree({ ...BOTH, next: "/app/library" })).rejects.toThrow(
      redirectsTo("/app/library"),
    );

    expect(consents()).toEqual([
      {
        userId: sampleUserId(TESTER),
        termsVersion: "2.0",
        privacyVersion: "2.0",
        agreedAt: BOOT.toISOString(),
      },
    ]);
    // Agreed, consent lets the Member through (the Active Device is checked next).
    const { requireConsentedMember } = await import("@/lib/member-app/guard");
    expect(await requireConsentedMember("/app/library")).toMatchObject({ email: TESTER });
  });

  it.each(["https://evil.example", "//x", "/admin", "/app/../admin", ""])(
    "continues to Home instead of next=%j",
    async (next) => {
      signedInAs(TESTER);
      await expect(agree({ ...BOTH, next })).rejects.toThrow(redirectsTo("/app"));
      expect(consents()).toHaveLength(1);
    },
  );

  it("adds a new agreement after a version change, keeping the old one", async () => {
    const old = await agreedAs(TESTER, "2.0", "1.0");
    vi.setSystemTime(new Date(BOOT.getTime() + 86_400_000));
    signedInAs(TESTER);

    await expect(agree({ ...BOTH, next: "/app" })).rejects.toThrow(redirectsTo("/app"));

    expect(consents()).toEqual([
      old,
      expect.objectContaining({
        termsVersion: "2.0",
        privacyVersion: "2.0",
        agreedAt: new Date(BOOT.getTime() + 86_400_000).toISOString(),
      }),
    ]);
  });

  it("adds no second record for a Member who has already agreed (a second click)", async () => {
    signedInAs(TESTER);
    await expect(agree({ ...BOTH, next: "/app" })).rejects.toThrow(redirectsTo("/app"));
    await expect(agree({ ...BOTH, next: "/app" })).rejects.toThrow(redirectsTo("/app"));
    expect(consents()).toHaveLength(1);
  });

  it.each([
    ["only the Terms box", { terms: "agreed" }],
    ["only the Privacy box", { privacy: "agreed" }],
    ["neither box", {}],
    ["a box with another value", { terms: "agreed", privacy: "on" }],
  ])("refuses %s on the server, and records nothing", async (_label, boxes) => {
    signedInAs(TESTER);
    const sent = { termsVersion: "2.0", privacyVersion: "2.0", next: "/app", ...boxes };

    expect(await agree(sent)).toEqual({
      error: "Tick both boxes to agree to the Terms and Privacy Policy.",
    });
    expect(consents()).toEqual([]);
  });

  it.each([
    ["an old Terms version", { termsVersion: "1.0" }],
    ["an old Privacy version", { privacyVersion: "1.0" }],
    ["a version from the future", { termsVersion: "9.0" }],
  ])(
    "refuses %s, records nothing, and reloads the screen with the current one",
    async (_label, shown) => {
      signedInAs(TESTER);
      await expect(agree({ ...BOTH, ...shown, next: "/app/library" })).rejects.toThrow(
        redirectsTo("/app/consent?next=%2Fapp%2Flibrary&outdated=1"),
      );
      expect(consents()).toEqual([]);
    },
  );

  it("reloads a stale screen with the current version before looking at its boxes", async () => {
    signedInAs(TESTER);
    await expect(
      agree({ terms: "agreed", termsVersion: "1.0", privacyVersion: "2.0", next: "/app" }),
    ).rejects.toThrow(redirectsTo("/app/consent?next=%2Fapp&outdated=1"));
    expect(consents()).toEqual([]);
  });

  it("treats a send with no versions as out of date", async () => {
    signedInAs(TESTER);
    await expect(agree({ terms: "agreed", privacy: "agreed", next: "/app" })).rejects.toThrow(
      redirectsTo("/app/consent?next=%2Fapp&outdated=1"),
    );
    expect(consents()).toEqual([]);
  });

  it("refuses a screen opened before the versions changed: the Member agrees to what they're shown", async () => {
    signedInAs(TESTER);
    legal.current = { terms: "2.0", privacy: "2.1" };
    await expect(agree({ ...BOTH, next: "/app" })).rejects.toThrow(
      redirectsTo("/app/consent?next=%2Fapp&outdated=1"),
    );
    expect(consents()).toEqual([]);
  });

  it("records the agreement for the signed-in Member only, ignoring any User named in the form", async () => {
    const other = await getOrCreateMember({
      userId: sampleUserId(OTHER),
      email: OTHER,
      name: null,
    });
    signedInAs(TESTER);

    await expect(
      agree({ ...BOTH, next: "/app", userId: other.userId, email: OTHER }),
    ).rejects.toThrow(redirectsTo("/app"));

    expect(consents().map((record) => record.userId)).toEqual([sampleUserId(TESTER)]);
  });

  it("refuses someone the gate doesn't let in, with no Member or consent record", async () => {
    signedInAs(STRANGER);
    await expect(agree({ ...BOTH, next: "/app" })).rejects.toThrow(NOT_OPEN_YET);
    expect(members()).toEqual([]);
    expect(consents()).toEqual([]);
  });

  it("sends a signed-out visitor to the sign-in screen, and records nothing", async () => {
    await expect(agree({ ...BOTH, next: "/app/library" })).rejects.toThrow(
      redirectsTo("/app/sign-in?next=%2Fapp%2Flibrary"),
    );
    expect(consents()).toEqual([]);
  });

  it("answers 404 in closed mode, and records nothing", async () => {
    mode.current = "closed";
    signedInAs(TESTER);
    await expect(agree({ ...BOTH, next: "/app" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(consents()).toEqual([]);
  });
});
