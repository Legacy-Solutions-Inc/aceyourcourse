import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { getSettingsForAdmin } from "@/services/admin";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { saveContactEmail, saveLinks, saveTrustFigures } from "./actions";

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
