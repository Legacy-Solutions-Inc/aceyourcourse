import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { announcementFormValues, promoBannerFormValues } from "@/lib/admin/promo-form";
import type { AnnouncementForm, PromoBannerForm } from "@/services/admin.schema";
import type { AdminAnnouncement, AdminPromoBanner, StaffActor } from "@/services/admin.types";
import { getWebsiteSettings } from "@/services/catalogue";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's promo area, run against every arm (spec, Phase 2 → Exam
// pages & promo; story 76): the Home promo banner, with its switch, and the
// announcement bar's 1–3 messages. Any Staff User can edit both, and every
// save is live on the Website. Each test boots the data at BOOT with a fake
// clock.
const BOOT = new Date("2026-10-22T03:42:00.000Z");
const MINUTE = 60 * 1000;
const at = (offset: number) => new Date(BOOT.getTime() + offset);

const OWNER: StaffActor = {
  email: "angel@aceyourcourse.ph",
  name: "Angel Rose L. Lepaña",
  role: "owner",
};
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

const NEVER_SAVED = { savedAt: BOOT.toISOString(), savedBy: null };
const SAVED_BY_EDITOR = { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name };

const SEED_BANNER = {
  visible: false,
  text: "11.11 · Any 2 reviewers, 4% off on Shopee",
  buttonLabel: "Shop the sale",
  href: "https://shopee.ph/aceyourcourse",
  startDate: "2026-11-09",
  endDate: "2026-11-11",
};

const SEED_MESSAGES = [
  {
    text: "Physical copies on Shopee, Lazada & TikTok Shop",
    href: "/products",
    requiresMemberApp: false,
  },
  { text: "Digital reviewers in the app · no auto-renew", href: "/app", requiresMemberApp: true },
  {
    text: "Ships from Iloilo City · SPayLater 0% on Shopee",
    href: "/faq",
    requiresMemberApp: false,
  },
];

const text = (length: number) => "d".repeat(length);
const LINK = "ENTER AN HTTPS LINK OR A PATH STARTING WITH /";
const ONE_TO_THREE = "THE BAR NEEDS 1 TO 3 MESSAGES";

describe.each(ADMIN_ARMS)("Admin seam: promo ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const later = () => vi.setSystemTime(at(MINUTE));
  const saved = <T>(result: { ok: boolean; value?: T }): T => {
    if (!result.ok || result.value === undefined) {
      throw new Error(`expected a save, got ${JSON.stringify(result)}`);
    }
    return result.value;
  };

  describe("the Home promo banner", () => {
    const banner = async (changes: Partial<PromoBannerForm>, actor = EDITOR) => {
      const opened = await seam.getPromoForAdmin(EDITOR);
      return seam.updatePromoBanner(
        actor,
        { ...promoBannerFormValues(opened.banner), ...changes },
        opened.stamp,
      );
    };

    it("opens the seed's banner, turned off, never saved", async () => {
      expect(await seam.getPromoForAdmin(EDITOR)).toEqual({
        banner: SEED_BANNER,
        stamp: NEVER_SAVED,
      });
    });

    it("saves the text, button label, link and dates, trimmed, live on Home, keeping the switch", async () => {
      later();
      const result = await banner({
        text: " Payday sale · 5% off ",
        buttonLabel: "Shop now",
        href: "/products?format=posters",
        startDate: "2026-11-28",
        endDate: "2026-11-30",
      });

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:settings"] });
      const value: AdminPromoBanner = saved(result);
      const payday = {
        visible: false,
        text: "Payday sale · 5% off",
        buttonLabel: "Shop now",
        href: "/products?format=posters",
        startDate: "2026-11-28",
        endDate: "2026-11-30",
      };
      expect(value).toEqual({ banner: payday, stamp: SAVED_BY_EDITOR });
      expect((await getWebsiteSettings()).promoBanner).toEqual(payday);
    });

    it("lets an Owner save it too", async () => {
      expect(await banner({ buttonLabel: "Shop" }, OWNER)).toMatchObject({ ok: true });
    });

    it("takes a one-day sale, and limits of exactly 80 and 24 characters", async () => {
      const result = await banner({
        text: text(80),
        buttonLabel: text(24),
        startDate: "2026-11-11",
        endDate: "2026-11-11",
      });
      expect(result).toMatchObject({ ok: true });
    });

    it.each<[string, Partial<PromoBannerForm>, Record<string, string[]>]>([
      [
        "blank text and button label",
        { text: " ", buttonLabel: "" },
        {
          text: ["ADD THE BANNER TEXT"],
          buttonLabel: ["ADD THE BUTTON LABEL"],
        },
      ],
      ["81 characters of text", { text: text(81) }, { text: ["KEEP IT TO 80 CHARACTERS"] }],
      [
        "a 25-character button label",
        { buttonLabel: text(25) },
        {
          buttonLabel: ["KEEP IT TO 24 CHARACTERS"],
        },
      ],
      ["a javascript: link", { href: "javascript:alert(1)" }, { href: [LINK] }],
      ["an http link", { href: "http://x" }, { href: [LINK] }],
      ["a link with no https://", { href: "shopee.ph/aceyourcourse" }, { href: [LINK] }],
      ["a protocol-relative link", { href: "//evil.example" }, { href: [LINK] }],
      ["a path a browser reads as another site", { href: "/\\evil.example" }, { href: [LINK] }],
      ["no link", { href: "" }, { href: ["ADD THE LINK"] }],
      [
        "an end date before the start date",
        { startDate: "2026-11-11", endDate: "2026-11-10" },
        {
          endDate: ["The end date can’t be before the start date."],
        },
      ],
      [
        "a date that isn't on the calendar",
        { startDate: "2026-02-30" },
        {
          startDate: ["ENTER A REAL DATE"],
        },
      ],
      ["a date that isn't a date", { endDate: "11 Nov 2026" }, { endDate: ["ENTER A REAL DATE"] }],
      [
        "no dates",
        { startDate: "", endDate: "" },
        {
          startDate: ["ADD THE START DATE"],
          endDate: ["ADD THE END DATE"],
        },
      ],
    ])("refuses %s, changing nothing", async (_case, changes, fieldErrors) => {
      expect(await banner(changes)).toEqual({ ok: false, error: { kind: "invalid", fieldErrors } });
      expect((await getWebsiteSettings()).promoBanner).toEqual(SEED_BANNER);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a save over a newer one, saying who saved it and when", async () => {
      const stale = await seam.getPromoForAdmin(EDITOR);
      later();
      saved(await banner({ buttonLabel: "Shop" }, OWNER));

      expect(
        await seam.updatePromoBanner(
          EDITOR,
          { ...promoBannerFormValues(stale.banner), text: "Stale" },
          stale.stamp,
        ),
      ).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: at(MINUTE).toISOString() },
      });
      expect((await getWebsiteSettings()).promoBanner?.text).toBe(SEED_BANNER.text);
    });

    it("records Staff Activity with the banner before and after", async () => {
      later();
      saved(await banner({ buttonLabel: "Shop" }));

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE).toISOString(),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "promo-banner",
          entityId: "home",
          action: "update",
          before: SEED_BANNER,
          after: { ...SEED_BANNER, buttonLabel: "Shop" },
        },
      ]);
    });

    it("makes a banner, turned off, when the Website has none", async () => {
      await arm.reset((seed) => {
        seed.settings.promoBanner = null;
      });
      const opened = await seam.getPromoForAdmin(EDITOR);
      expect(opened.banner).toBeNull();

      const result = await seam.updatePromoBanner(
        EDITOR,
        { ...promoBannerFormValues(null), ...SEED_BANNER },
        opened.stamp,
      );
      expect(saved(result).banner).toEqual(SEED_BANNER);
    });
  });

  describe("the banner's switch", () => {
    it("turns the banner on at once, with no conflict check, live on Home", async () => {
      later();
      const result = await seam.setPromoBannerVisible(EDITOR, true);

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:settings"] });
      expect(saved(result).banner?.visible).toBe(true);
      expect((await getWebsiteSettings()).promoBanner?.visible).toBe(true);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "promo-banner",
          entityId: "home",
          action: "turn-on",
          before: SEED_BANNER,
          after: { ...SEED_BANNER, visible: true },
        }),
      ]);
    });

    it("turns it off now, keeping its text for the next sale", async () => {
      saved(await seam.setPromoBannerVisible(OWNER, true));
      const result = await seam.setPromoBannerVisible(EDITOR, false);

      expect(saved(result).banner).toEqual(SEED_BANNER);
      expect((await arm.staffActivity()).map((record) => record.action)).toEqual([
        "turn-on",
        "turn-off",
      ]);
    });

    it("doesn't make the open banner editor conflict", async () => {
      const opened = await seam.getPromoForAdmin(EDITOR);
      later();
      saved(await seam.setPromoBannerVisible(OWNER, true));

      expect((await seam.getPromoForAdmin(EDITOR)).stamp).toEqual(NEVER_SAVED);
      const result = await seam.updatePromoBanner(
        EDITOR,
        { ...promoBannerFormValues(opened.banner), buttonLabel: "Shop" },
        opened.stamp,
      );
      // The editor's save keeps the switch as it now is.
      expect(saved(result).banner).toMatchObject({ visible: true, buttonLabel: "Shop" });
    });

    it("refuses to turn on a banner the Website doesn't have yet", async () => {
      await arm.reset((seed) => {
        seed.settings.promoBanner = null;
      });
      expect(await seam.setPromoBannerVisible(EDITOR, true)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "SAVE THE BANNER FIRST" },
      });
    });

    it("refuses a switch that isn't on or off", async () => {
      expect(await seam.setPromoBannerVisible(EDITOR, "yes" as unknown as boolean)).toMatchObject({
        ok: false,
        error: { kind: "invalid" },
      });
    });
  });

  describe("the announcement bar", () => {
    const announcement = async (
      form: (current: AnnouncementForm) => AnnouncementForm,
      actor = EDITOR,
    ) => {
      const opened = await seam.getAnnouncementForAdmin(EDITOR);
      return seam.updateAnnouncement(
        actor,
        form(announcementFormValues(opened.announcement)),
        opened.stamp,
      );
    };
    const editSecond = (current: AnnouncementForm): AnnouncementForm => ({
      messages: current.messages.map((message, index) =>
        index === 1 ? { ...message, text: "Digital reviewers in the app · from ₱149" } : message,
      ),
    });

    it("opens the seed's messages, its id, and whether the Member App is live", async () => {
      expect(await seam.getAnnouncementForAdmin(EDITOR)).toEqual({
        announcement: { id: "2026-10-launch", messages: SEED_MESSAGES },
        memberAppLive: false,
        stamp: NEVER_SAVED,
      });
    });

    it("saves changed messages under a new id, so Visitors who dismissed the bar see it again", async () => {
      later();
      const result = await announcement(editSecond);

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:settings"] });
      const value: AdminAnnouncement = saved(result);
      expect(value.announcement.id).toBe(`ann-${at(MINUTE).toISOString()}`);
      expect(value.stamp).toEqual(SAVED_BY_EDITOR);
      expect((await getWebsiteSettings()).announcement).toEqual({
        id: `ann-${at(MINUTE).toISOString()}`,
        messages: [
          SEED_MESSAGES[0],
          { ...SEED_MESSAGES[1], text: "Digital reviewers in the app · from ₱149" },
          SEED_MESSAGES[2],
        ],
      });
    });

    it("keeps the id when nothing changed, so dismissed bars stay dismissed", async () => {
      later();
      const result = await announcement((current) => current);

      expect(saved(result).announcement.id).toBe("2026-10-launch");
      expect((await getWebsiteSettings()).announcement.id).toBe("2026-10-launch");
    });

    it("keeps the id when only the space around a message changed", async () => {
      const result = await announcement(({ messages }) => ({
        messages: messages.map((message) => ({ ...message, text: ` ${message.text} ` })),
      }));
      expect(saved(result).announcement.id).toBe("2026-10-launch");
    });

    it.each<[string, (current: AnnouncementForm) => AnnouncementForm]>([
      [
        "a new order",
        ({ messages: [first, second, third] }) => ({
          messages: [second, first, third].filter((m) => m !== undefined),
        }),
      ],
      [
        "a message only while the Member App is live",
        ({ messages }) => ({
          messages: messages.map((m, i) => (i === 0 ? { ...m, requiresMemberApp: true } : m)),
        }),
      ],
      [
        "a new link",
        ({ messages }) => ({
          messages: messages.map((m, i) => (i === 2 ? { ...m, href: "/faq#faq-ship" } : m)),
        }),
      ],
      ["a removed message", ({ messages }) => ({ messages: messages.slice(0, 2) })],
    ])("gives %s a new id", async (_case, form) => {
      later();
      expect(saved(await announcement(form)).announcement.id).toBe(
        `ann-${at(MINUTE).toISOString()}`,
      );
    });

    it("saves the order the messages are given in, live on every page", async () => {
      const result = await announcement(({ messages: [first, second, third] }) => ({
        messages: [third, first, second].filter((m) => m !== undefined),
      }));
      saved(result);
      expect((await getWebsiteSettings()).announcement.messages.map((m) => m.href)).toEqual([
        "/faq",
        "/products",
        "/app",
      ]);
    });

    it("saves one message, and an https link", async () => {
      const result = await announcement(() => ({
        messages: [
          { text: "Follow us", href: "https://www.facebook.com/x", requiresMemberApp: false },
        ],
      }));
      expect(saved(result).announcement.messages).toHaveLength(1);
    });

    it("takes a message of exactly 70 characters", async () => {
      expect(
        await announcement(({ messages }) => ({
          messages: messages.map((m, i) => (i === 0 ? { ...m, text: text(70) } : m)),
        })),
      ).toMatchObject({ ok: true });
    });

    it.each<[string, (current: AnnouncementForm) => AnnouncementForm, object]>([
      ["no messages", () => ({ messages: [] }), { fieldErrors: {}, formError: ONE_TO_THREE }],
      [
        "a fourth message",
        ({ messages }) => ({
          messages: [...messages, { text: "Fourth", href: "/", requiresMemberApp: false }],
        }),
        { fieldErrors: {}, formError: ONE_TO_THREE },
      ],
      [
        "71 characters of text",
        ({ messages }) => ({
          messages: messages.map((m, i) => (i === 1 ? { ...m, text: text(71) } : m)),
        }),
        { fieldErrors: { "messages.1.text": ["KEEP IT TO 70 CHARACTERS"] } },
      ],
      [
        "a blank message",
        ({ messages }) => ({
          messages: messages.map((m, i) => (i === 0 ? { ...m, text: "  " } : m)),
        }),
        { fieldErrors: { "messages.0.text": ["ADD THE MESSAGE"] } },
      ],
      [
        "a javascript: link and an http link",
        ({ messages }) => ({
          messages: messages.map((m, i) =>
            i === 0
              ? { ...m, href: "javascript:alert(1)" }
              : i === 2
                ? { ...m, href: "http://x" }
                : m,
          ),
        }),
        { fieldErrors: { "messages.0.href": [LINK], "messages.2.href": [LINK] } },
      ],
    ])("refuses %s, changing nothing", async (_case, form, error) => {
      expect(await announcement(form)).toEqual({
        ok: false,
        error: { kind: "invalid", ...error },
      });
      expect((await getWebsiteSettings()).announcement).toEqual({
        id: "2026-10-launch",
        messages: SEED_MESSAGES,
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a save over a newer one, saying who saved it and when", async () => {
      const stale = await seam.getAnnouncementForAdmin(EDITOR);
      later();
      saved(await announcement(editSecond, OWNER));

      expect(
        await seam.updateAnnouncement(
          EDITOR,
          announcementFormValues(stale.announcement),
          stale.stamp,
        ),
      ).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: at(MINUTE).toISOString() },
      });
    });

    it("lets an Owner save it too, and records Staff Activity with the bar before and after", async () => {
      later();
      const result = saved(await announcement(editSecond, OWNER));

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE).toISOString(),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "announcement",
          entityId: "website",
          action: "update",
          before: { id: "2026-10-launch", messages: SEED_MESSAGES },
          after: result.announcement,
        },
      ]);
    });
  });
});
