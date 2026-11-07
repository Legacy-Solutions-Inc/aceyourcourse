import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffActor } from "@/services/admin.types";
import { getWebsiteSettings } from "@/services/catalogue";
import { updateWebsiteSettings } from "@/services/mock/admin/settings";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's Settings area, run against every arm: the Website's contact
// email, Marketplace shop links, social links and shop-wide trust figures
// (spec, Phase 2 → Settings, Conflict check, Staff Activity). Saves go live on
// the Website through the Catalogue seam. Each test boots the data at BOOT with
// a fake clock.
const BOOT = new Date("2026-10-22T03:42:00.000Z");
const MINUTE = 60 * 1000;
const at = (offset: number) => new Date(BOOT.getTime() + offset);

const OWNER: StaffActor = {
  email: "angel@aceyourcourse.ph",
  name: "Angel Rose L. Lepaña",
  role: "owner",
};
const SECOND_OWNER: StaffActor = {
  email: "owner2@example.com",
  name: "Second Owner",
  role: "owner",
};
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

const SEED_SETTINGS = {
  contactEmail: "aceyourcourseinc@gmail.com",
  shopLinks: {
    shopee: "https://shopee.ph/aceyourcourse",
    lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
    tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
  },
  socialLinks: {
    tiktok: "https://www.tiktok.com/@aceyourcourse",
    facebook: "https://www.facebook.com/aceyourcourseph",
    instagram: "https://www.instagram.com/aceyourcourseph",
  },
  shopStats: { rating: 4.8, ratingCount: 874, followers: "3.7K", asOf: "2026-10-29" },
};

const NEW_EMAIL = "hello@aceyourcourse.ph";

/** Moves the fake clock to `when`. */
const clockAt = (when: Date) => vi.setSystemTime(when);

describe.each(ADMIN_ARMS)("Admin seam: Settings ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    clockAt(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The settings and their stamp, as an Owner opening Settings now would get them. */
  const open = () => seam.getSettingsForAdmin();

  /** Asserts that nothing was saved since the data was made. */
  async function expectNothingSaved() {
    expect(await open()).toEqual({
      values: SEED_SETTINGS,
      stamp: { savedAt: BOOT.toISOString(), savedBy: null },
    });
    expect(await arm.staffActivity()).toEqual([]);
    expect((await getWebsiteSettings()).contactEmail).toBe(SEED_SETTINGS.contactEmail);
  }

  describe("getSettingsForAdmin", () => {
    it("reads the contact email, links and trust figures, stamped when the data was made, by nobody", async () => {
      await expectNothingSaved();
    });
  });

  describe("updateWebsiteSettings: saving", () => {
    it("saves the Owner's contact email, live on the Website, stamped, with the settings tag to clear", async () => {
      clockAt(at(MINUTE));
      const { stamp } = await open();

      const result = await seam.updateWebsiteSettings(OWNER, { contactEmail: NEW_EMAIL }, stamp);

      expect(result).toEqual({
        ok: true,
        value: {
          values: { ...SEED_SETTINGS, contactEmail: NEW_EMAIL },
          stamp: { savedAt: at(MINUTE).toISOString(), savedBy: OWNER.name },
        },
        tags: ["catalogue:settings"],
      });
      expect((await getWebsiteSettings()).contactEmail).toBe(NEW_EMAIL);
      expect(await open()).toEqual(result.ok ? result.value : null);
    });

    it("trims the email, and puts https:// on a link typed without it or with http://", async () => {
      const result = await seam.updateWebsiteSettings(OWNER, {
        contactEmail: `  ${NEW_EMAIL} `,
        shopLinks: {
          shopee: " shopee.ph/aceyourcourse ",
          lazada: "http://www.lazada.com.ph/shop/aceyourcourse",
          tiktok: "HTTPS://vt.tiktok.com/ZS49ve6cu/",
        },
        socialLinks: { tiktok: "tiktok.com/@aceyourcourse", facebook: null, instagram: null },
      });

      expect(result.ok && result.value.values).toMatchObject({
        contactEmail: NEW_EMAIL,
        shopLinks: {
          shopee: "https://shopee.ph/aceyourcourse",
          lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
          tiktok: "https://vt.tiktok.com/ZS49ve6cu/",
        },
        socialLinks: { tiktok: "https://tiktok.com/@aceyourcourse" },
      });
    });

    it("clears an emptied link, which hides that button or link on the Website", async () => {
      await seam.updateWebsiteSettings(OWNER, {
        shopLinks: { ...SEED_SETTINGS.shopLinks, lazada: "" },
        socialLinks: { ...SEED_SETTINGS.socialLinks, instagram: "   " },
      });

      const website = await getWebsiteSettings();
      expect(website.shopLinks).toEqual({ ...SEED_SETTINGS.shopLinks, lazada: null });
      expect(website.socialLinks).toEqual({ ...SEED_SETTINGS.socialLinks, instagram: null });
    });

    it("saves the trust figures with as of set to today in Manila, already tomorrow there", async () => {
      // 16:30 UTC on 1 Nov is 00:30 on 2 Nov in Manila.
      clockAt(new Date("2026-11-01T16:30:00.000Z"));
      const result = await seam.updateWebsiteSettings(OWNER, {
        shopStats: { rating: 4.9, ratingCount: 900, followers: "3.8K" },
      });

      const shopStats = { rating: 4.9, ratingCount: 900, followers: "3.8K", asOf: "2026-11-02" };
      expect(result.ok && result.value.values.shopStats).toEqual(shopStats);
      expect((await getWebsiteSettings()).shopStats).toEqual(shopStats);
    });

    it("leaves the trust figures and their as of date alone when it isn't given them", async () => {
      clockAt(at(30 * 24 * 60 * MINUTE));
      await seam.updateWebsiteSettings(OWNER, { contactEmail: NEW_EMAIL });

      const { values } = await open();
      expect(values.shopStats).toEqual(SEED_SETTINGS.shopStats);
      expect(values.shopLinks).toEqual(SEED_SETTINGS.shopLinks);
      expect(values.socialLinks).toEqual(SEED_SETTINGS.socialLinks);
    });

    it.each([
      [0, 0],
      [5, 0],
      [4, 12_345],
    ])("accepts a rating of %d from %d ratings", async (rating, ratingCount) => {
      const result = await seam.updateWebsiteSettings(OWNER, {
        shopStats: { rating, ratingCount, followers: "12" },
      });
      expect(result.ok && result.value.values.shopStats).toMatchObject({ rating, ratingCount });
    });

    it("ignores what Settings doesn't edit, such as the announcement", async () => {
      const { announcement } = await getWebsiteSettings();
      const input = {
        contactEmail: NEW_EMAIL,
        announcement: { id: "hijacked", messages: [] },
      };
      await seam.updateWebsiteSettings(OWNER, input);
      expect((await getWebsiteSettings()).announcement).toEqual(announcement);
    });
  });

  describe("updateWebsiteSettings: Staff Activity", () => {
    it("appends one record per save, with who, when, and the values before and after", async () => {
      clockAt(at(MINUTE));
      await seam.updateWebsiteSettings(OWNER, { contactEmail: NEW_EMAIL });
      clockAt(at(2 * MINUTE));
      await seam.updateWebsiteSettings(OWNER, {
        shopStats: { rating: 4.9, ratingCount: 900, followers: "3.8K" },
      });

      const activity = await arm.staffActivity();
      expect(activity).toHaveLength(2);
      expect(activity[0]).toEqual({
        id: expect.any(String),
        at: at(MINUTE).toISOString(),
        actor: { email: OWNER.email, name: OWNER.name },
        entity: "settings",
        entityId: "website",
        action: "update",
        before: SEED_SETTINGS,
        after: { ...SEED_SETTINGS, contactEmail: NEW_EMAIL },
      });
      expect(activity[1]).toMatchObject({
        at: at(2 * MINUTE).toISOString(),
        before: { contactEmail: NEW_EMAIL, shopStats: SEED_SETTINGS.shopStats },
        after: {
          contactEmail: NEW_EMAIL,
          shopStats: { rating: 4.9, ratingCount: 900, followers: "3.8K", asOf: "2026-10-22" },
        },
      });
      expect(activity[0]?.id).not.toBe(activity[1]?.id);
    });
  });

  describe("updateWebsiteSettings: the conflict check", () => {
    it("refuses a save over a newer one, naming who saved it and when, and keeps the newer values", async () => {
      const { stamp: openedByBoth } = await open();
      clockAt(at(MINUTE));
      await seam.updateWebsiteSettings(OWNER, { contactEmail: NEW_EMAIL }, openedByBoth);

      clockAt(at(2 * MINUTE));
      const late = await seam.updateWebsiteSettings(
        SECOND_OWNER,
        { contactEmail: "late@example.com" },
        openedByBoth,
      );

      expect(late).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: at(MINUTE).toISOString() },
      });
      expect((await open()).values.contactEmail).toBe(NEW_EMAIL);
      expect(await arm.staffActivity()).toHaveLength(1);
    });

    it("catches a save made in the same millisecond as the one the editor opened", async () => {
      const { stamp: opened } = await open();
      await seam.updateWebsiteSettings(OWNER, { contactEmail: NEW_EMAIL }, opened);

      const late = await seam.updateWebsiteSettings(
        SECOND_OWNER,
        { contactEmail: "late@example.com" },
        opened,
      );
      expect(late).toMatchObject({ ok: false, error: { kind: "conflict", savedBy: OWNER.name } });
    });

    it("saves an editor that holds the latest stamp", async () => {
      const first = await seam.updateWebsiteSettings(OWNER, { contactEmail: NEW_EMAIL });
      if (!first.ok) throw new Error("the first save failed");

      const second = await seam.updateWebsiteSettings(
        OWNER,
        { contactEmail: "again@example.com" },
        first.value.stamp,
      );
      expect(second.ok).toBe(true);
    });

    it("refuses a save from an editor opened before the sample data was reset, saved by nobody", async () => {
      const { stamp: opened } = await open();
      clockAt(at(MINUTE));
      await arm.reset();

      const late = await seam.updateWebsiteSettings(OWNER, { contactEmail: NEW_EMAIL }, opened);
      expect(late).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: null, savedAt: at(MINUTE).toISOString() },
      });
    });
  });

  describe("updateWebsiteSettings: refused", () => {
    it("refuses an Editor, changing nothing and recording nothing", async () => {
      const result = await seam.updateWebsiteSettings(EDITOR, { contactEmail: NEW_EMAIL });

      expect(result).toEqual({
        ok: false,
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN CHANGE SETTINGS" },
      });
      await expectNothingSaved();
    });

    it.each(["not-an-email", "", "   ", "angel@", "angel rose@aceyourcourse.ph"])(
      "refuses the contact email %j, changing nothing",
      async (contactEmail) => {
        expect(await seam.updateWebsiteSettings(OWNER, { contactEmail })).toEqual({
          ok: false,
          error: {
            kind: "invalid",
            fieldErrors: { contactEmail: ["ENTER A VALID EMAIL ADDRESS"] },
          },
        });
        await expectNothingSaved();
      },
    );

    const SHOP = "SHOULD BE A SHOPEE.PH LINK";
    it.each([
      ["shopLinks", "shopee", "https://www.lazada.com.ph/shop/aceyourcourse", SHOP],
      ["shopLinks", "shopee", "shopee.com/aceyourcourse", SHOP],
      ["shopLinks", "shopee", "https://shopee.ph.example.com/aceyourcourse", SHOP],
      ["shopLinks", "shopee", "not a link", SHOP],
      ["shopLinks", "lazada", "https://shopee.ph/aceyourcourse", "SHOULD BE A LAZADA.COM.PH LINK"],
      ["shopLinks", "tiktok", "https://shopee.ph/aceyourcourse", "SHOULD BE A TIKTOK LINK"],
      [
        "socialLinks",
        "tiktok",
        "https://www.tiktok.com/aceyourcourse",
        "SHOULD LOOK LIKE TIKTOK.COM/@NAME",
      ],
      [
        "socialLinks",
        "tiktok",
        "https://vt.tiktok.com/ZS49ve6cu/",
        "SHOULD LOOK LIKE TIKTOK.COM/@NAME",
      ],
      ["socialLinks", "tiktok", "https://www.tiktok.com/@", "SHOULD LOOK LIKE TIKTOK.COM/@NAME"],
      [
        "socialLinks",
        "facebook",
        "https://www.instagram.com/aceyourcourseph",
        "SHOULD BE A FACEBOOK.COM LINK",
      ],
      [
        "socialLinks",
        "instagram",
        "https://www.facebook.com/aceyourcourseph",
        "SHOULD BE AN INSTAGRAM.COM LINK",
      ],
    ] as const)("refuses %s.%s %j: %s", async (group, field, value, message) => {
      const changed = (which: typeof group) => (group === which ? { [field]: value } : {});
      const input = {
        shopLinks: { ...SEED_SETTINGS.shopLinks, ...changed("shopLinks") },
        socialLinks: { ...SEED_SETTINGS.socialLinks, ...changed("socialLinks") },
      };

      expect(await seam.updateWebsiteSettings(OWNER, input)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { [`${group}.${field}`]: [message] } },
      });
      await expectNothingSaved();
    });

    const RATING = "ENTER A RATING FROM 0 TO 5, WITH ONE DECIMAL AT MOST";
    const COUNT = "ENTER A WHOLE NUMBER, 0 OR MORE";
    const FOLLOWERS = "ENTER THE FOLLOWERS AS SHOPEE SHOWS THEM, LIKE 3.7K";
    it.each([
      [{ rating: 5.1 }, "rating", RATING],
      [{ rating: 4.85 }, "rating", RATING],
      [{ rating: -0.1 }, "rating", RATING],
      [{ rating: Number.NaN }, "rating", RATING],
      [{ ratingCount: -1 }, "ratingCount", COUNT],
      [{ ratingCount: 1.5 }, "ratingCount", COUNT],
      [{ followers: "" }, "followers", FOLLOWERS],
      [{ followers: "   " }, "followers", FOLLOWERS],
    ])("refuses the trust figures %j", async (change, field, message) => {
      const shopStats = { rating: 4.9, ratingCount: 900, followers: "3.8K", ...change };
      expect(await seam.updateWebsiteSettings(OWNER, { shopStats })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { [`shopStats.${field}`]: [message] } },
      });
      await expectNothingSaved();
    });

    it("reports every field's problem in one go", async () => {
      const result = await seam.updateWebsiteSettings(OWNER, {
        contactEmail: "nope",
        shopLinks: { shopee: "https://lazada.com.ph/x", lazada: null, tiktok: null },
        socialLinks: { tiktok: null, facebook: null, instagram: "https://facebook.com/x" },
        shopStats: { rating: 6, ratingCount: -2, followers: "" },
      });
      const fields = !result.ok && result.error.kind === "invalid" ? result.error.fieldErrors : {};
      expect(Object.keys(fields).sort()).toEqual(
        [
          "contactEmail",
          "shopLinks.shopee",
          "socialLinks.instagram",
          "shopStats.rating",
          "shopStats.ratingCount",
          "shopStats.followers",
        ].sort(),
      );
    });

    it("refuses a save with nothing in it", async () => {
      expect(await seam.updateWebsiteSettings(OWNER, {})).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "NOTHING TO SAVE" },
      });
      await expectNothingSaved();
    });
  });
});

// The sample arm saves to a draft copy and validates the whole catalogue before
// it commits (CONVENTIONS §3), so no save can break the Website.
describe("Admin seam: Settings (sample data only)", () => {
  beforeEach(() => {
    resetSampleStore();
  });

  it("commits nothing when the catalogue as a whole would fail validation", async () => {
    // A broken catalogue, which the Admin itself could never save.
    const store = getSampleStore();
    const [first] = store.catalogue.exams;
    if (!first) throw new Error("the seed has no Exams");
    store.catalogue.exams.push(structuredClone(first));
    const before = structuredClone(store.catalogue.settings);

    const result = await updateWebsiteSettings(OWNER, { contactEmail: NEW_EMAIL });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "invalid",
        fieldErrors: {},
        formError: "THIS WOULD BREAK THE WEBSITE, SO IT WASN’T SAVED",
      },
    });
    expect(getSampleStore().catalogue.settings).toEqual(before);
    expect(getSampleStore().staffActivity).toEqual([]);
    expect(getSampleStore().stamps).toEqual({});
  });
});
