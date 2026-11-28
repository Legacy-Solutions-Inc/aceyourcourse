import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE, hashDeviceToken } from "@/lib/member-app/device-token";
import { claimDevice, getOrCreateMember, recordConsent } from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { AGREED_TO_CURRENT } from "../../../../test/member-inputs";
import { redirectsTo } from "../../../../test/redirects";

// "Sign in on this device" in live mode (Phase 3, ticket 04; story 108): on
// "Session ended" it starts Google sign-in, coming back through
// /auth/callback to the /app path the Member was on, and the callback claims
// the device (its tests are in src/app/auth/callback/route.test.ts). Here,
// Supabase is the boundary: who is signed in and Google's start are replaced;
// the gate, consent and the Member seam run on sample data.
const { jar, user, startGoogleSignIn } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  user: { current: null as { userId: string; email: string; name: string } | null },
  startGoogleSignIn: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers(),
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
  adminMode: "live",
}));
vi.mock("@/lib/admin/identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/identity")>()),
  getSignedInUser: async () => user.current,
  startGoogleSignIn,
}));

const TESTER = "tester@example.com";
const BEA = { userId: sampleUserId(TESTER), email: TESTER, name: "Bea Tester" };
const GOOGLE = "https://accounts.google.example/o/oauth2/auth?state=x";

async function signInOnThisDevice(next: string) {
  const data = new FormData();
  data.set("next", next);
  return (await import("./actions")).signInOnThisDevice(data);
}

/** Bea, agreed, on a device another one replaced. */
async function replacedBea() {
  await getOrCreateMember(BEA);
  await recordConsent(BEA.userId, AGREED_TO_CURRENT);
  await claimDevice(BEA.userId, {
    tokenHash: hashDeviceToken("the-other-device"),
    deviceLabel: "Safari on iOS",
  });
  user.current = BEA;
  jar.set(DEVICE_COOKIE, "this-device");
}

beforeEach(() => {
  jar.clear();
  user.current = null;
  startGoogleSignIn.mockReset();
  resetSampleStore();
});

describe("signInOnThisDevice (live)", () => {
  it("starts Google sign-in, coming back to the /app path the Member was on, and claims nothing yet", async () => {
    await replacedBea();
    startGoogleSignIn.mockResolvedValue({ ok: true, url: GOOGLE });

    await expect(signInOnThisDevice("/app/account")).rejects.toThrow(redirectsTo(GOOGLE));

    expect(startGoogleSignIn).toHaveBeenCalledWith("/app/account", "member-app");
    expect(getSampleStore().memberDeviceSwitches).toHaveLength(1);
    expect(jar.get(DEVICE_COOKIE)).toBe("this-device");
  });

  it.each(["https://evil.example", "/admin", "/app/device"])(
    "comes back to Home instead of next=%j",
    async (next) => {
      await replacedBea();
      startGoogleSignIn.mockResolvedValue({ ok: true, url: GOOGLE });

      await expect(signInOnThisDevice(next)).rejects.toThrow(redirectsTo(GOOGLE));
      expect(startGoogleSignIn).toHaveBeenCalledWith("/app", "member-app");
    },
  );

  it.each([
    ["isn't answering", "unreachable", "unreachable"],
    ["isn't set up", "not-set-up", "google-not-set-up"],
  ])(
    "returns to “Session ended” saying why when Google sign-in %s",
    async (_label, reason, problem) => {
      await replacedBea();
      startGoogleSignIn.mockResolvedValue({ ok: false, reason });

      await expect(signInOnThisDevice("/app/account")).rejects.toThrow(
        redirectsTo(`/app/device?next=%2Fapp%2Faccount&error=${problem}`),
      );
      expect(getSampleStore().memberDeviceSwitches).toHaveLength(1);
    },
  );

  it("sends a Member who hasn't agreed to the consent screen, starting no Google sign-in", async () => {
    await getOrCreateMember(BEA);
    user.current = BEA;

    await expect(signInOnThisDevice("/app/account")).rejects.toThrow(
      redirectsTo("/app/consent?next=%2Fapp%2Faccount"),
    );
    expect(startGoogleSignIn).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in, starting no Google sign-in", async () => {
    await expect(signInOnThisDevice("/app/account")).rejects.toThrow(
      redirectsTo("/app/sign-in?next=%2Fapp%2Faccount"),
    );
    expect(startGoogleSignIn).not.toHaveBeenCalled();
  });
});
