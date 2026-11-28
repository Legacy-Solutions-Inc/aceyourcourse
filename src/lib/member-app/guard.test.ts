import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE, hashDeviceToken } from "@/lib/member-app/device-token";
import { removeBetaTester, removeStaff } from "@/services/admin.mock";
import { claimDevice, getOrCreateMember, recordConsent } from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import { ANDROID_CHROME, onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";
import { redirectsTo } from "../../../test/redirects";

// The Member App gate on the server, with the sample identity: the sample
// cookie names the signed-in User, and the switch, the staff list and the Beta
// Tester list decide on every call. next/headers and next/navigation are the
// framework boundary, so they are replaced: the cookie jar is a Map, and
// redirect() and notFound() throw what they would. The switch, the mode and
// the current legal versions are as the server would read them, and a test
// can change any of them.
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
const EDITOR = sampleActor("editor");
const KIM = "kim.reyes@gmail.com";
const TESTER = "tester@example.com";
const STRANGER = "stranger@example.com";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
/** This request comes from the browser that is now this Member's Active Device. */
async function onTheActiveDevice(userId: string) {
  await onThisDevice(userId);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
}

/** Matches the error redirect() throws for exactly this URL. */
const NOT_OPEN_YET = redirectsTo("/app/not-open-yet");
const DEVICE_SCREEN = (next: string) => redirectsTo(`/app/device?next=${encodeURIComponent(next)}`);

const members = () => getSampleStore().members;
const consents = () => getSampleStore().memberConsents;

/** The sample Beta Tester, already a Member, having agreed to these versions. */
async function testerAgreed(termsVersion: string, privacyVersion: string) {
  const userId = sampleUserId(TESTER);
  await getOrCreateMember({ userId, email: TESTER, name: "Bea Tester" });
  await recordConsent(userId, { termsVersion, privacyVersion });
  return userId;
}

async function loadGuard() {
  return import("./guard");
}

describe("the Member App gate on the server (sample mode)", () => {
  beforeEach(() => {
    jar.clear();
    live.current = false;
    mode.current = "sample";
    legal.current = { terms: "2.0", privacy: "2.0" };
    resetSampleStore();
  });

  describe("requireGatedMember (the gate alone), while the switch is off", () => {
    it("sends a signed-out visitor to the sign-in screen, coming back to Home", async () => {
      const { requireGatedMember } = await loadGuard();
      await expect(requireGatedMember()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp"));
    });

    it("comes back to the screen that asked", async () => {
      const { requireGatedMember } = await loadGuard();
      await expect(requireGatedMember("/app/library")).rejects.toThrow(
        redirectsTo("/app/sign-in?next=%2Fapp%2Flibrary"),
      );
    });

    it("lets a Beta Tester in, and makes their Member record on the way", async () => {
      signInAs(TESTER);
      const { requireGatedMember } = await loadGuard();

      const member = await requireGatedMember();

      expect(member).toMatchObject({ email: TESTER, name: "Bea Tester" });
      expect(member.userId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(members()).toEqual([member]);
    });

    it("gives the same Member record on every later request", async () => {
      signInAs(TESTER);
      const { requireGatedMember } = await loadGuard();

      const first = await requireGatedMember();
      expect(await requireGatedMember("/app/library")).toEqual(first);
      expect(members()).toHaveLength(1);
    });

    it("matches the Beta Tester list whatever the email's case", async () => {
      signInAs("  Tester@Example.COM ");
      const { requireGatedMember } = await loadGuard();
      expect(await requireGatedMember()).toMatchObject({ email: TESTER });
    });

    it("lets an active Staff User in, an Owner or an Editor, without being a Beta Tester", async () => {
      const { requireGatedMember } = await loadGuard();
      signInAs(OWNER.email);
      expect(await requireGatedMember()).toMatchObject({ email: OWNER.email, name: OWNER.name });
      signInAs(EDITOR.email);
      expect(await requireGatedMember()).toMatchObject({ email: EDITOR.email });
      expect(members()).toHaveLength(2);
    });

    it("refuses anyone else: “Not open yet”, with no Member record made", async () => {
      signInAs(STRANGER);
      const { requireGatedMember } = await loadGuard();

      await expect(requireGatedMember()).rejects.toThrow(NOT_OPEN_YET);
      await expect(requireGatedMember("/app/library")).rejects.toThrow(NOT_OPEN_YET);
      expect(members()).toEqual([]);
    });

    it("refuses a removed tester at their next request, keeping their Member record", async () => {
      signInAs(TESTER);
      const { requireGatedMember } = await loadGuard();
      const member = await requireGatedMember();

      await removeBetaTester(OWNER, TESTER);

      await expect(requireGatedMember()).rejects.toThrow(NOT_OPEN_YET);
      expect(members()).toEqual([member]);
    });

    it("treats removed Staff as anyone else, at their next request", async () => {
      signInAs(EDITOR.email);
      const { requireGatedMember } = await loadGuard();
      await requireGatedMember();

      await removeStaff(OWNER, EDITOR.email);

      await expect(requireGatedMember()).rejects.toThrow(NOT_OPEN_YET);
    });

    it("treats Staff with an unused Invite as anyone else, and doesn't activate the Invite", async () => {
      signInAs(KIM);
      const { requireGatedMember } = await loadGuard();

      await expect(requireGatedMember()).rejects.toThrow(NOT_OPEN_YET);

      const { staff, invites, staffActivity, deniedSignIns } = getSampleStore();
      expect(staff.map((member) => member.email)).not.toContain(KIM);
      expect(invites.map((invite) => invite.email)).toContain(KIM);
      expect(staffActivity).toEqual([]);
      // The Member App refuses quietly: the Admin's refusal log is the Admin's.
      expect(deniedSignIns).toEqual([]);
      expect(members()).toEqual([]);
    });

    it("treats Staff whose Invite expired as anyone else", async () => {
      signInAs("expired.invite@example.com");
      const { requireGatedMember } = await loadGuard();

      await expect(requireGatedMember()).rejects.toThrow(NOT_OPEN_YET);
      expect(getSampleStore().deniedSignIns).toEqual([]);
      expect(members()).toEqual([]);
    });

    it("treats a cookie that doesn't hold an email address as signed out", async () => {
      signInAs("not-an-email");
      const { requireGatedMember } = await loadGuard();
      await expect(requireGatedMember()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp"));
    });
  });

  describe("requireGatedMember (the gate alone), once the switch is on", () => {
    beforeEach(() => {
      live.current = true;
    });

    it("lets anyone in, and makes their Member record", async () => {
      signInAs(STRANGER);
      const { requireGatedMember } = await loadGuard();

      expect(await requireGatedMember()).toMatchObject({ email: STRANGER, name: "Sam Stranger" });
      expect(members()).toHaveLength(1);
    });

    it("lets in an email that is on no list at all", async () => {
      signInAs("someone.new@example.com");
      const { requireGatedMember } = await loadGuard();
      expect(await requireGatedMember()).toMatchObject({
        email: "someone.new@example.com",
        name: null,
      });
    });

    it("still sends a signed-out visitor to the sign-in screen", async () => {
      const { requireGatedMember } = await loadGuard();
      await expect(requireGatedMember()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp"));
    });
  });

  // Every Member App page and Member App Server Action runs requireMember:
  // the gate, then consent (spec, Phase 3 → Consent). Only the consent screen
  // and its action stop at the gate.
  describe("requireMember: the gate, then consent, then the Active Device", () => {
    it("sends a signed-out visitor to the sign-in screen first, coming back", async () => {
      const { requireMember } = await loadGuard();
      await expect(requireMember("/app/library")).rejects.toThrow(
        redirectsTo("/app/sign-in?next=%2Fapp%2Flibrary"),
      );
    });

    it("sends someone the gate doesn't let in to “Not open yet”, with no Member or consent record", async () => {
      signInAs(STRANGER);
      const { requireMember } = await loadGuard();

      await expect(requireMember()).rejects.toThrow(NOT_OPEN_YET);
      expect(members()).toEqual([]);
      expect(consents()).toEqual([]);
    });

    it("sends a new Member to the consent screen, coming back, with their Member record made and nothing agreed", async () => {
      signInAs(TESTER);
      const { requireMember } = await loadGuard();

      await expect(requireMember("/app/library")).rejects.toThrow(
        redirectsTo("/app/consent?next=%2Fapp%2Flibrary"),
      );
      expect(members()).toMatchObject([{ email: TESTER }]);
      expect(consents()).toEqual([]);
    });

    it("lets in a Member whose latest agreement has both current versions, on their Active Device", async () => {
      signInAs(TESTER);
      const userId = await testerAgreed("2.0", "2.0");
      await onTheActiveDevice(userId);
      const { requireMember } = await loadGuard();

      expect(await requireMember()).toMatchObject({ userId, email: TESTER });
    });

    it("sends an agreed Member with no device token to the Active Device screen, coming back", async () => {
      signInAs(TESTER);
      await testerAgreed("2.0", "2.0");
      const { requireMember } = await loadGuard();

      await expect(requireMember("/app/library")).rejects.toThrow(DEVICE_SCREEN("/app/library"));
    });

    it("sends a replaced device to the Active Device screen, coming back", async () => {
      signInAs(TESTER);
      const userId = await testerAgreed("2.0", "2.0");
      await onTheActiveDevice(userId);
      await claimDevice(userId, {
        tokenHash: hashDeviceToken("another-device"),
        deviceLabel: "Safari on iOS",
      });
      const { requireMember } = await loadGuard();

      await expect(requireMember("/app/plans")).rejects.toThrow(DEVICE_SCREEN("/app/plans"));
    });

    it("checks consent before the device: a replaced device that hasn't agreed goes to the consent screen", async () => {
      signInAs(TESTER);
      const userId = await testerAgreed("1.0", "1.0");
      await claimDevice(userId, {
        tokenHash: hashDeviceToken("another-device"),
        deviceLabel: "Safari on iOS",
      });
      jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
      const { requireMember } = await loadGuard();

      await expect(requireMember()).rejects.toThrow(redirectsTo("/app/consent?next=%2Fapp"));
    });

    it.each([
      ["the Terms", { terms: "2.1", privacy: "2.0" }],
      ["the Privacy Policy", { terms: "2.0", privacy: "2.1" }],
      ["both", { terms: "3.0", privacy: "3.0" }],
    ])("asks again at the next request once %s change version", async (_label, bumped) => {
      signInAs(TESTER);
      await onTheActiveDevice(await testerAgreed("2.0", "2.0"));
      const { requireMember } = await loadGuard();
      expect(await requireMember()).toMatchObject({ email: TESTER });

      legal.current = bumped;

      await expect(requireMember("/app/plans")).rejects.toThrow(
        redirectsTo("/app/consent?next=%2Fapp%2Fplans"),
      );
    });

    it("checks the gate before consent: a removed tester who agreed goes to “Not open yet”", async () => {
      signInAs(TESTER);
      await testerAgreed("2.0", "2.0");
      await removeBetaTester(OWNER, TESTER);
      const { requireMember } = await loadGuard();

      await expect(requireMember()).rejects.toThrow(NOT_OPEN_YET);
    });
  });

  describe("requireConsentedMember: the gate and consent, for the Active Device screen", () => {
    it("lets in an agreed Member whatever the device", async () => {
      signInAs(TESTER);
      const userId = await testerAgreed("2.0", "2.0");
      const { requireConsentedMember } = await loadGuard();

      expect(await requireConsentedMember()).toMatchObject({ userId });
    });

    it("sends a Member who hasn't agreed to the consent screen, coming back", async () => {
      signInAs(TESTER);
      const { requireConsentedMember } = await loadGuard();
      await expect(requireConsentedMember("/app/account")).rejects.toThrow(
        redirectsTo("/app/consent?next=%2Fapp%2Faccount"),
      );
    });
  });

  describe("claimDeviceAtSignIn", () => {
    const switches = () => getSampleStore().memberDeviceSwitches;

    it("makes this device the Active Device of someone the gate lets in, labelled from the User-Agent", async () => {
      signInAs(TESTER);
      const { claimDeviceAtSignIn, requireMember } = await loadGuard();
      await claimDeviceAtSignIn();

      expect(switches()).toMatchObject([
        { userId: sampleUserId(TESTER), deviceLabel: "Chrome on Android" },
      ]);
      expect(jar.get(DEVICE_COOKIE)).toMatch(/^[A-Za-z0-9_-]{43}$/);
      await recordConsent(sampleUserId(TESTER), { termsVersion: "2.0", privacyVersion: "2.0" });
      expect(await requireMember()).toMatchObject({ email: TESTER });
    });

    it("claims nothing for someone the gate turns away, and makes no Member record", async () => {
      signInAs(STRANGER);
      const { claimDeviceAtSignIn } = await loadGuard();
      await claimDeviceAtSignIn();

      expect(switches()).toEqual([]);
      expect(members()).toEqual([]);
      expect(jar.has(DEVICE_COOKIE)).toBe(false);
    });

    it("claims nothing when nobody is signed in", async () => {
      const { claimDeviceAtSignIn } = await loadGuard();
      await claimDeviceAtSignIn();
      expect(switches()).toEqual([]);
    });
  });

  describe("checkConsent", () => {
    it("answers first-time, with the current versions, for a Member who never agreed", async () => {
      const { checkConsent } = await loadGuard();
      expect(await checkConsent(sampleUserId(TESTER))).toEqual({
        status: "first-time",
        current: { terms: "2.0", privacy: "2.0" },
      });
    });

    it("names what changed since the Member's latest agreement", async () => {
      const userId = await testerAgreed("2.0", "1.0");
      const { checkConsent } = await loadGuard();
      expect(await checkConsent(userId)).toMatchObject({ status: "privacy-changed" });
    });

    it("answers ok once the Member agrees to the current versions", async () => {
      const userId = await testerAgreed("2.0", "2.0");
      const { checkConsent } = await loadGuard();
      expect(await checkConsent(userId)).toMatchObject({ status: "ok" });
    });
  });

  describe("getMemberAppAccess", () => {
    it("says who is signed out, let in, or not let in yet, and makes no Member record", async () => {
      const { getMemberAppAccess } = await loadGuard();

      expect(await getMemberAppAccess()).toEqual({ status: "signed-out" });
      signInAs(TESTER);
      expect(await getMemberAppAccess()).toMatchObject({ status: "open", user: { email: TESTER } });
      signInAs(STRANGER);
      expect(await getMemberAppAccess()).toMatchObject({
        status: "not-open-yet",
        user: { email: STRANGER, name: "Sam Stranger" },
      });
      expect(members()).toEqual([]);
    });
  });

  describe("closed mode (production with no database and no Supabase)", () => {
    beforeEach(() => {
      mode.current = "closed";
      signInAs(TESTER);
    });

    it("answers 404 from every entry point, whatever cookie is sent", async () => {
      const { getMemberAppAccess, requireGatedMember, requireMember, requireMemberAppOpen } =
        await loadGuard();

      expect(() => requireMemberAppOpen()).toThrow("NEXT_NOT_FOUND");
      await expect(requireMember()).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(requireGatedMember()).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(getMemberAppAccess()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(members()).toEqual([]);
      expect(consents()).toEqual([]);
    });
  });
});
