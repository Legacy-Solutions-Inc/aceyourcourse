import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { getSettingsForAdmin } from "@/services/admin";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import {
  addInvite,
  cancelStaffInvite,
  changeStaffMemberRole,
  removeStaffMember,
  renewStaffInvite,
  saveContactEmail,
  saveLinks,
  saveTrustFigures,
} from "./actions";

// Settings' Server Actions, called as a browser would call them: each one is a
// public endpoint, so the Owners-only rule is checked here on the server, not
// only by hiding Settings from an Editor's menu.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

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

const IDLE: AdminActionState<never> = { status: "idle" };
const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const settings = () => structuredClone(getSampleStore().catalogue.settings);
const opened = () => ({ savedAt: getSampleStore().bootedAt });

const LINKS = {
  shopLinks: { shopee: "shopee.ph/aceyourcourse", lazada: "", tiktok: "" },
  socialLinks: { tiktok: "tiktok.com/@aceyourcourse", facebook: "", instagram: "" },
};
const FIGURES = { shopStats: { rating: "4.9", ratingCount: "900", followers: "3.8K" } };

describe("Settings actions", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    vi.mocked(revalidateTag).mockClear();
  });

  it.each([
    ["saveContactEmail", saveContactEmail, { contactEmail: "hello@aceyourcourse.ph" }],
    ["saveLinks", saveLinks, LINKS],
    ["saveTrustFigures", saveTrustFigures, FIGURES],
  ] as const)(
    "%s refuses an Editor calling it directly: nothing changes and no Staff Activity is added",
    async (_name, action, input) => {
      signInAs("content@aceyourcourse.ph");
      const before = settings();

      expect(await action(IDLE, { input, expected: opened() })).toEqual({
        status: "refused",
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" },
      });
      expect(settings()).toEqual(before);
      expect(getSampleStore().staffActivity).toEqual([]);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  it("saves the Owner's contact email and clears the settings tag, so it's live", async () => {
    signInAs("angel@aceyourcourse.ph");
    const state = await saveContactEmail(IDLE, {
      input: { contactEmail: "hello@aceyourcourse.ph" },
      expected: opened(),
    });

    expect(state).toMatchObject({
      status: "saved",
      value: {
        values: { contactEmail: "hello@aceyourcourse.ph" },
        stamp: { savedBy: "Angel Rose L. Lepaña" },
      },
    });
    expect(settings().contactEmail).toBe("hello@aceyourcourse.ph");
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([["catalogue:settings"]]);
  });

  it("saves the links and the trust figures from the form's text", async () => {
    signInAs("angel@aceyourcourse.ph");
    await saveLinks(IDLE, { input: LINKS, expected: opened() });
    const { stamp } = await getSettingsForAdmin();
    await saveTrustFigures(IDLE, { input: FIGURES, expected: stamp });

    expect(settings()).toMatchObject({
      shopLinks: { shopee: "https://shopee.ph/aceyourcourse", lazada: null, tiktok: null },
      socialLinks: { tiktok: "https://tiktok.com/@aceyourcourse", instagram: null },
      shopStats: { rating: 4.9, ratingCount: 900, followers: "3.8K" },
    });
  });

  it("saves only its own part: the contact email action can't change the links or figures", async () => {
    signInAs("angel@aceyourcourse.ph");
    const before = settings();

    await saveContactEmail(IDLE, {
      input: { contactEmail: "hello@aceyourcourse.ph", ...LINKS, ...FIGURES },
      expected: opened(),
    });

    expect(settings()).toEqual({ ...before, contactEmail: "hello@aceyourcourse.ph" });
  });
});

// Admin accounts: the Staff and Invites actions, Owners only. Each is called
// as a browser would, with no expected stamp: the staff list's rules, not the
// conflict check, decide.
describe("Admin accounts actions", () => {
  const OWNER = "angel@aceyourcourse.ph";
  const EDITOR = "content@aceyourcourse.ph";
  const staffList = () => {
    const { staff, invites, staffActivity } = getSampleStore();
    return structuredClone({ staff, invites, staffActivity });
  };

  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    vi.mocked(revalidateTag).mockClear();
  });

  const ACTIONS = [
    ["addInvite", addInvite, { email: "new.editor@example.com", role: "editor" }],
    ["renewStaffInvite", renewStaffInvite, { email: "expired.invite@example.com" }],
    ["cancelStaffInvite", cancelStaffInvite, { email: "kim.reyes@gmail.com" }],
    ["changeStaffMemberRole", changeStaffMemberRole, { email: EDITOR, role: "owner" }],
    ["removeStaffMember", removeStaffMember, { email: OWNER }],
  ] as const;

  it.each(ACTIONS)(
    "%s refuses an Editor calling it directly, and nothing changes",
    async (_name, action, input) => {
      signInAs(EDITOR);
      const before = staffList();

      expect(await action(IDLE, { input })).toEqual({
        status: "refused",
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" },
      });
      expect(staffList()).toEqual(before);
    },
  );

  it.each(ACTIONS)("%s sends a signed-out caller to sign-in", async (_name, action, input) => {
    const before = staffList();
    await expect(action(IDLE, { input })).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
    expect(staffList()).toEqual(before);
  });

  it("invites for the Owner, and clears no cache tag", async () => {
    signInAs(OWNER);
    const state = await addInvite(IDLE, {
      input: { email: " New.Editor@Example.com ", role: "editor" },
    });

    expect(state).toMatchObject({
      status: "saved",
      value: { email: "new.editor@example.com", role: "editor" },
    });
    expect(getSampleStore().invites.map((invite) => invite.email)).toContain(
      "new.editor@example.com",
    );
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("answers the invite form's field message for an email already on the staff list", async () => {
    signInAs(OWNER);
    expect(
      await addInvite(IDLE, { input: { email: "KIM.REYES@gmail.com", role: "editor" } }),
    ).toEqual({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: { email: ["This email is already on the staff list."] },
      },
    });
  });

  it("answers not-found for renewing an Invite that was already cancelled", async () => {
    signInAs(OWNER);
    await cancelStaffInvite(IDLE, { input: { email: "kim.reyes@gmail.com" } });
    expect(await renewStaffInvite(IDLE, { input: { email: "kim.reyes@gmail.com" } })).toEqual({
      status: "refused",
      error: { kind: "not-found" },
    });
  });

  it("refuses the Owner removing themselves as the last Owner", async () => {
    signInAs(OWNER);
    expect(await removeStaffMember(IDLE, { input: { email: OWNER } })).toEqual({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {},
        formError: "There must always be at least one Owner.",
      },
    });
  });

  it("demotes an Owner on their next request: their Owner-only action is refused", async () => {
    signInAs(OWNER);
    await changeStaffMemberRole(IDLE, { input: { email: EDITOR, role: "owner" } });
    signInAs(EDITOR);
    expect(
      await addInvite(IDLE, { input: { email: "a@example.com", role: "editor" } }),
    ).toMatchObject({ status: "saved" });

    signInAs(OWNER);
    await changeStaffMemberRole(IDLE, { input: { email: EDITOR, role: "editor" } });
    signInAs(EDITOR);
    expect(await addInvite(IDLE, { input: { email: "b@example.com", role: "editor" } })).toEqual({
      status: "refused",
      error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" },
    });
  });

  it("removes a Staff User at once: their next action goes to the 403 screen", async () => {
    signInAs(OWNER);
    expect(await removeStaffMember(IDLE, { input: { email: EDITOR } })).toMatchObject({
      status: "saved",
      value: { email: EDITOR },
    });

    signInAs(EDITOR);
    await expect(
      saveContactEmail(IDLE, { input: { contactEmail: "x@example.com" } }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin\/denied\?reason=not-staff$/);
  });
});
