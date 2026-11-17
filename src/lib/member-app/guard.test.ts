import { beforeEach, describe, expect, it, vi } from "vitest";

import { removeBetaTester, removeStaff } from "@/services/admin.mock";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";

// The Member App gate on the server, with the sample identity: the sample
// cookie names the signed-in User, and the switch, the staff list and the Beta
// Tester list decide on every call. next/headers and next/navigation are the
// framework boundary, so they are replaced: the cookie jar is a Map, and
// redirect() and notFound() throw what they would. The switch and the mode
// are as the server would read them, and a test can change either.
const { jar, live, mode } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  live: { current: false },
  mode: { current: "sample" as "sample" | "closed" },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
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

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");
const KIM = "kim.reyes@gmail.com";
const TESTER = "tester@example.com";
const STRANGER = "stranger@example.com";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
/** Matches the error redirect() throws for exactly this URL. */
const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const NOT_OPEN_YET = redirectsTo("/app/not-open-yet");

const members = () => getSampleStore().members;

async function loadGuard() {
  return import("./guard");
}

describe("the Member App gate on the server (sample mode)", () => {
  beforeEach(() => {
    jar.clear();
    live.current = false;
    mode.current = "sample";
    resetSampleStore();
  });

  describe("requireMember, while the switch is off", () => {
    it("sends a signed-out visitor to the sign-in screen, coming back to Home", async () => {
      const { requireMember } = await loadGuard();
      await expect(requireMember()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp"));
    });

    it("comes back to the screen that asked", async () => {
      const { requireMember } = await loadGuard();
      await expect(requireMember("/app/library")).rejects.toThrow(
        redirectsTo("/app/sign-in?next=%2Fapp%2Flibrary"),
      );
    });

    it("lets a Beta Tester in, and makes their Member record on the way", async () => {
      signInAs(TESTER);
      const { requireMember } = await loadGuard();

      const member = await requireMember();

      expect(member).toMatchObject({ email: TESTER, name: "Bea Tester" });
      expect(member.userId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(members()).toEqual([member]);
    });

    it("gives the same Member record on every later request", async () => {
      signInAs(TESTER);
      const { requireMember } = await loadGuard();

      const first = await requireMember();
      expect(await requireMember("/app/library")).toEqual(first);
      expect(members()).toHaveLength(1);
    });

    it("matches the Beta Tester list whatever the email's case", async () => {
      signInAs("  Tester@Example.COM ");
      const { requireMember } = await loadGuard();
      expect(await requireMember()).toMatchObject({ email: TESTER });
    });

    it("lets an active Staff User in, an Owner or an Editor, without being a Beta Tester", async () => {
      const { requireMember } = await loadGuard();
      signInAs(OWNER.email);
      expect(await requireMember()).toMatchObject({ email: OWNER.email, name: OWNER.name });
      signInAs(EDITOR.email);
      expect(await requireMember()).toMatchObject({ email: EDITOR.email });
      expect(members()).toHaveLength(2);
    });

    it("refuses anyone else: “Not open yet”, with no Member record made", async () => {
      signInAs(STRANGER);
      const { requireMember } = await loadGuard();

      await expect(requireMember()).rejects.toThrow(NOT_OPEN_YET);
      await expect(requireMember("/app/library")).rejects.toThrow(NOT_OPEN_YET);
      expect(members()).toEqual([]);
    });

    it("refuses a removed tester at their next request, keeping their Member record", async () => {
      signInAs(TESTER);
      const { requireMember } = await loadGuard();
      const member = await requireMember();

      await removeBetaTester(OWNER, TESTER);

      await expect(requireMember()).rejects.toThrow(NOT_OPEN_YET);
      expect(members()).toEqual([member]);
    });

    it("treats removed Staff as anyone else, at their next request", async () => {
      signInAs(EDITOR.email);
      const { requireMember } = await loadGuard();
      await requireMember();

      await removeStaff(OWNER, EDITOR.email);

      await expect(requireMember()).rejects.toThrow(NOT_OPEN_YET);
    });

    it("treats Staff with an unused Invite as anyone else, and doesn't activate the Invite", async () => {
      signInAs(KIM);
      const { requireMember } = await loadGuard();

      await expect(requireMember()).rejects.toThrow(NOT_OPEN_YET);

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
      const { requireMember } = await loadGuard();

      await expect(requireMember()).rejects.toThrow(NOT_OPEN_YET);
      expect(getSampleStore().deniedSignIns).toEqual([]);
      expect(members()).toEqual([]);
    });

    it("treats a cookie that doesn't hold an email address as signed out", async () => {
      signInAs("not-an-email");
      const { requireMember } = await loadGuard();
      await expect(requireMember()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp"));
    });
  });

  describe("requireMember, once the switch is on", () => {
    beforeEach(() => {
      live.current = true;
    });

    it("lets anyone in, and makes their Member record", async () => {
      signInAs(STRANGER);
      const { requireMember } = await loadGuard();

      expect(await requireMember()).toMatchObject({ email: STRANGER, name: "Sam Stranger" });
      expect(members()).toHaveLength(1);
    });

    it("lets in an email that is on no list at all", async () => {
      signInAs("someone.new@example.com");
      const { requireMember } = await loadGuard();
      expect(await requireMember()).toMatchObject({ email: "someone.new@example.com", name: null });
    });

    it("still sends a signed-out visitor to the sign-in screen", async () => {
      const { requireMember } = await loadGuard();
      await expect(requireMember()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp"));
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
      const { getMemberAppAccess, requireMember, requireMemberAppOpen } = await loadGuard();

      expect(() => requireMemberAppOpen()).toThrow("NEXT_NOT_FOUND");
      await expect(requireMember()).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(getMemberAppAccess()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(members()).toEqual([]);
    });
  });
});
