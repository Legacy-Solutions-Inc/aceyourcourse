import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import * as root from "./actions";
import * as consent from "./consent/actions";
import * as signIn from "./sign-in/actions";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App's gate matrix (spec, Phase 3 → The beta gate and Consent):
// every Member App Server Action is a public endpoint, so each one is listed
// here with who may call it, and called as a browser would by everyone it
// must refuse:
//   - "member": behind the gate, then consent. Signed out goes to the sign-in
//     screen, someone the gate doesn't let in goes to "Not open yet", with no
//     Member record made, and a Member who hasn't agreed to the current Terms
//     and Privacy Policy goes to the consent screen.
//   - "before-consent": behind the gate only. That's the consent action alone,
//     since consent is what it gives.
//   - "anyone": signing in and out, which happen before the gate. Those are
//     refused only when the Member App is closed.
// Anyone at all gets a 404 in closed mode. A new action in any "use server"
// module under src/app/app that isn't in the registry fails the first test, so
// a later ticket's action can't skip the gate unnoticed.
// ─────────────────────────────────────────────────────────────────────────────

const { jar, mode } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  mode: { current: "sample" as "sample" | "closed" },
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
vi.mock("@/lib/admin/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/mode")>()),
  get adminMode() {
    return mode.current;
  },
}));

const STRANGER = "stranger@example.com";

interface Entry {
  who: "member" | "before-consent" | "anyone";
  /** Calls the action with an input it would accept. */
  call: () => Promise<unknown>;
}
const anyone = (call: Entry["call"]): Entry => ({ who: "anyone", call });
const beforeConsent = (call: Entry["call"]): Entry => ({ who: "before-consent", call });

/** Both boxes ticked, with versions the consent screen could have shown. */
function consentForm() {
  const data = new FormData();
  for (const name of ["terms", "privacy"]) data.set(name, "agreed");
  data.set("termsVersion", "2.0");
  data.set("privacyVersion", "2.0");
  data.set("next", "/app");
  return data;
}

function signInForm(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

/** This folder: every actions.ts under it holds Member App Server Actions. */
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Every exported Member App Server Action, by its module, relative to this folder. */
const REGISTRY: Record<string, Record<string, Entry>> = {
  "./actions.ts": {
    signOut: anyone(() => root.signOut()),
  },
  "./consent/actions.ts": {
    agreeAndContinue: beforeConsent(() => consent.agreeAndContinue({ error: null }, consentForm())),
  },
  "./sign-in/actions.ts": {
    signInAs: anyone(() => signIn.signInAs({ error: null, email: "" }, signInForm(STRANGER))),
    // Live mode only: sample mode answers 404.
    continueWithGoogle: anyone(() => signIn.continueWithGoogle(new FormData())),
  },
};

const ENTRIES = Object.entries(REGISTRY).flatMap(([module, actions]) =>
  Object.entries(actions).map(([name, entry]) => ({ module, name, ...entry })),
);
const GATED = ENTRIES.filter((entry) => entry.who !== "anyone");
const MEMBER_ONLY = ENTRIES.filter((entry) => entry.who === "member");

/** The "use server" modules under this folder, and what each exports. */
function serverActionModules(): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const file of readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    const source = readFileSync(path.join(APP_DIR, file), "utf8");
    if (!/^\s*["']use server["'];?/.test(source)) continue;
    const names = [...source.matchAll(/^export (?:async function|const) (\w+)/gm)].map(
      (match) => match[1] ?? "",
    );
    found[`./${file.split(path.sep).join("/")}`] = names.sort();
  }
  return found;
}

beforeEach(() => {
  jar.clear();
  mode.current = "sample";
  resetSampleStore();
});

describe("the Member App's Server Actions and the gate", () => {
  it("lists every Server Action under src/app/app, each with who may call it", () => {
    const listed = Object.fromEntries(
      Object.entries(REGISTRY).map(([module, actions]) => [module, Object.keys(actions).sort()]),
    );
    expect(serverActionModules()).toEqual(listed);
  });

  it.each(ENTRIES)("$name answers 404 in closed mode", async ({ call }) => {
    mode.current = "closed";
    jar.set("ayc_admin_sample", "tester@example.com");
    await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getSampleStore().members).toEqual([]);
    expect(getSampleStore().memberConsents).toEqual([]);
  });

  it.each(ENTRIES.filter((entry) => entry.who === "anyone"))(
    "$name, open to anyone, makes no Member record",
    async ({ call }) => {
      await call().catch(() => {});
      expect(getSampleStore().members).toEqual([]);
    },
  );

  it.each(GATED)("$name sends a signed-out visitor to the sign-in screen", async ({ call }) => {
    await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/app\/sign-in/);
    expect(getSampleStore().memberConsents).toEqual([]);
  });

  it.each(GATED)(
    "$name refuses someone the gate doesn't let in, and makes no Member or consent record",
    async ({ call }) => {
      jar.set("ayc_admin_sample", STRANGER);
      await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/app\/not-open-yet$/);
      expect(getSampleStore().members).toEqual([]);
      expect(getSampleStore().memberConsents).toEqual([]);
    },
  );

  // No action needs consent yet: the consent action is the only one past the
  // gate. The first one a later ticket registers as "member" is checked here.
  if (MEMBER_ONLY.length > 0) {
    it.each(MEMBER_ONLY)(
      "$name sends a Member who hasn't agreed to the current Terms and Privacy Policy to the consent screen",
      async ({ call }) => {
        jar.set("ayc_admin_sample", "tester@example.com");
        await expect(call()).rejects.toThrow(/^NEXT_REDIRECT \/app\/consent\?next=/);
        expect(getSampleStore().memberConsents).toEqual([]);
      },
    );
  }
});
