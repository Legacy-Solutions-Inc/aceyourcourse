import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aboutSectionFormValues } from "@/lib/admin/about-form";
import { ABOUT_DEFAULTS, ABOUT_LIMITS, resolveAbout } from "@/lib/catalogue/about-content";
import type { AboutSectionForm } from "@/services/admin.schema";
import type { AdminAbout, StaffActor } from "@/services/admin.types";
import { getSitePage } from "@/services/catalogue";
import type { AboutSectionKey } from "@/services/catalogue.types";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's About area, run against every arm (ticket 21; spec, Phase
// 2 → Site pages, Conflict check, Staff Activity; story 80b): About's six
// sections, each saved on its own over today's text. Blank is today's text,
// every save is live on the Website, and photos come from the upload seam.
// Each test boots the data at BOOT with a fake clock.
const BOOT = new Date("2026-11-05T03:42:00.000Z");
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

const HEADING = "We passed the boards. Then we built the reviewers.";
const DESCRIBE = "Describe the photo for screen readers.";
const NOT_UPLOADED = "THE IMAGE ISN’T UPLOADED · ADD IT AGAIN";
const WAIT_FOR_UPLOADS = "Wait for uploads to finish.";

type FormOf<S extends AboutSectionKey> = Extract<AboutSectionForm, { section: S }>;

describe.each(ADMIN_ARMS)("Admin seam: About ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const saved = (result: { ok: boolean; value?: AdminAbout }) => {
    if (!result.ok || !result.value)
      throw new Error(`expected a save, got ${JSON.stringify(result)}`);
    return result.value;
  };
  /** Saves a section as its editor would: its form as opened, with these changes. */
  const save = async <S extends AboutSectionKey>(
    section: S,
    changes: (form: FormOf<S>) => void,
    actor = EDITOR,
  ) => {
    const opened = await seam.getAboutForAdmin(actor);
    const form = aboutSectionFormValues(opened.about, section);
    changes(form);
    return seam.updateAboutSection(actor, form, opened.stamps[section]);
  };
  const about = async () => resolveAbout((await getSitePage("about")).about);
  const later = () => vi.setSystemTime(at(MINUTE));

  describe("getAboutForAdmin", () => {
    it("opens with nothing saved, and each section never saved", async () => {
      const opened = await seam.getAboutForAdmin(EDITOR);
      expect(resolveAbout(opened.about)).toEqual(ABOUT_DEFAULTS);
      expect(opened.stamps).toEqual({
        header: NEVER_SAVED,
        story: NEVER_SAVED,
        growth: NEVER_SAVED,
        mission: NEVER_SAVED,
        roots: NEVER_SAVED,
        closing: NEVER_SAVED,
      });
      // The database has no About record until the first save.
      expect((await getSitePage("about")).about).toBeNull();
    });
  });

  describe("updateAboutSection", () => {
    it("saves an Editor's story heading, live on the Website, with Staff Activity", async () => {
      later();
      const result = await save("story", (form) => (form.heading = ` ${HEADING} `));

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:site-pages"] });
      expect(saved(result).stamps.story).toEqual(SAVED_BY_EDITOR);
      // Only the story's stamp moved.
      expect(saved(result).stamps.header).toEqual(NEVER_SAVED);
      const shown = await about();
      expect(shown.story.heading).toBe(HEADING);
      expect({
        ...shown,
        story: { ...shown.story, heading: ABOUT_DEFAULTS.story.heading },
      }).toEqual(ABOUT_DEFAULTS);
      const [record, ...more] = await arm.staffActivity();
      expect(more).toEqual([]);
      expect(record).toEqual({
        id: expect.any(String),
        at: at(MINUTE).toISOString(),
        actor: { email: EDITOR.email, name: EDITOR.name },
        entity: "site-page",
        entityId: "about",
        action: "update-about-story",
        before: expect.objectContaining({ heading: null, paragraphs: null }),
        after: expect.objectContaining({ heading: HEADING, paragraphs: null }),
      });
    });

    it("saves an Owner's section too", async () => {
      saved(await save("roots", (form) => (form.heading = "Packed with care in Iloilo."), OWNER));
      expect((await about()).roots.heading).toBe("Packed with care in Iloilo.");
    });

    it("keeps the SEO and the other Site pages as they were", async () => {
      saved(await save("closing", (form) => (form.heading = "Your turn.")));
      expect(await getSitePage("about")).toMatchObject({
        seoTitle: null,
        seoDescription: null,
        shareImage: null,
      });
      expect((await getSitePage("home")).about).toBeNull();
    });

    it("saves a blank field as none, so the Website shows today's text again", async () => {
      saved(await save("growth", (form) => (form.nowLead = "We kept going.")));
      expect((await about()).growth.nowLead).toBe("We kept going.");
      saved(await save("growth", (form) => (form.nowLead = "   ")));
      expect((await about()).growth.nowLead).toBe(ABOUT_DEFAULTS.growth.nowLead);
      expect((await getSitePage("about")).about?.growth.nowLead).toBeNull();
    });

    it("saves the typed paragraphs and chips as a list, blanks dropped, and none when all are blank", async () => {
      saved(
        await save("story", (form) => {
          form.paragraphs = ["", "Only the second.", " "];
          form.afterSpecs = ["A6", "", "Spiral", "", ""];
        }),
      );
      expect((await about()).story.paragraphs).toEqual(["Only the second."]);
      expect((await about()).story.afterSpecs).toEqual(["A6", "Spiral"]);

      saved(
        await save("story", (form) => {
          form.paragraphs = ["", "", ""];
          form.afterSpecs = ["", "", "", "", ""];
        }),
      );
      expect((await getSitePage("about")).about?.story).toMatchObject({
        paragraphs: null,
        afterSpecs: null,
      });
      expect((await about()).story.paragraphs).toEqual(ABOUT_DEFAULTS.story.paragraphs);
    });

    it("changes only mission tab 02", async () => {
      saved(
        await save("mission", (form) => {
          form.tabs[1] = {
            title: "Always current",
            body: "Each edition follows the latest exams.",
          };
        }),
      );
      expect((await about()).mission.tabs).toEqual([
        ABOUT_DEFAULTS.mission.tabs[0],
        { title: "Always current", body: "Each edition follows the latest exams." },
        ABOUT_DEFAULTS.mission.tabs[2],
        ABOUT_DEFAULTS.mission.tabs[3],
      ]);
    });

    it("keeps markup as typed, as plain text", async () => {
      saved(await save("roots", (form) => (form.heading = "<b>hi</b> <script>")));
      expect((await about()).roots.heading).toBe("<b>hi</b> <script>");
    });

    it("takes a field at its limit, and refuses one character over with its message", async () => {
      const limit = ABOUT_LIMITS.story.heading;
      expect(await save("story", (form) => (form.heading = "h".repeat(limit)))).toMatchObject({
        ok: true,
      });
      expect(await save("story", (form) => (form.heading = "h".repeat(limit + 1)))).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { heading: [`KEEP IT TO ${limit} CHARACTERS`] },
        },
      });
    });

    it.each([
      ["header", "intro", ABOUT_LIMITS.header.intro],
      ["growth", "todayBody", ABOUT_LIMITS.growth.todayBody],
      ["roots", "recipient", ABOUT_LIMITS.roots.recipient],
      ["closing", "heading", ABOUT_LIMITS.closing.heading],
    ] as const)("refuses %s's %s over its %i-character limit", async (section, field, limit) => {
      const result = await save(section, (form) => {
        (form as Record<string, unknown>)[field] = "x".repeat(limit + 1);
      });
      expect(result).toMatchObject({
        ok: false,
        error: { fieldErrors: { [field]: [`KEEP IT TO ${limit} CHARACTERS`] } },
      });
    });

    it("refuses a paragraph, a tab's text and a chip over their limits, naming each", async () => {
      const result = await save("story", (form) => {
        form.paragraphs[2] = "p".repeat(ABOUT_LIMITS.story.paragraph + 1);
        form.afterSpecs[4] = "c".repeat(21);
      });
      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            "paragraphs.2": [`KEEP IT TO ${ABOUT_LIMITS.story.paragraph} CHARACTERS`],
            "afterSpecs.4": ["KEEP IT TO 20 CHARACTERS"],
          },
        },
      });
      const limit = ABOUT_LIMITS.mission.tabs[3]?.body ?? 0;
      expect(
        await save("mission", (form) => {
          form.tabs[3] = { title: "", body: "t".repeat(limit + 1) };
        }),
      ).toMatchObject({
        ok: false,
        error: { fieldErrors: { "tabs.3.body": [`KEEP IT TO ${limit} CHARACTERS`] } },
      });
    });

    it("refuses a fourth paragraph and a sixth chip", async () => {
      expect(await save("story", (form) => (form.paragraphs = ["1", "2", "3", "4"]))).toMatchObject(
        { ok: false, error: { fieldErrors: { paragraphs: [expect.any(String)] } } },
      );
      expect(
        await save("story", (form) => (form.afterSpecs = ["1", "2", "3", "4", "5", "6"])),
      ).toMatchObject({ ok: false, error: { fieldErrors: { afterSpecs: [expect.any(String)] } } });
      expect((await getSitePage("about")).about).toBeNull();
    });

    it("refuses a section About doesn't have", async () => {
      const opened = await seam.getAboutForAdmin(EDITOR);
      expect(
        await seam.updateAboutSection(
          EDITOR,
          { section: "team", heading: "x" } as never,
          opened.stamps.header,
        ),
      ).toMatchObject({ ok: false, error: { kind: "invalid" } });
      expect(await arm.staffActivity()).toEqual([]);
    });

    describe("photos", () => {
      const ALT = "A reviewee opening her package at home";

      it("saves story photo 2 from the upload seam with its alt text, and the others stay today's", async () => {
        const upload = await arm.uploadPhoto({ purpose: "about-photo" });
        const result = await save("story", (form) => {
          form.photos[1] = { src: upload.path, alt: ` ${ALT} ` };
        });
        expect(saved(result).about.story.photos[1]).toEqual({ src: upload.publicUrl, alt: ALT });
        expect((await about()).story.photos).toEqual([
          ABOUT_DEFAULTS.story.photos[0],
          { src: upload.publicUrl, alt: ALT },
          ABOUT_DEFAULTS.story.photos[2],
        ]);

        // Saved again as it opened, the photo stays; its alt text can change.
        saved(await save("story", (form) => (form.heading = HEADING)));
        saved(
          await save("story", (form) => (form.photos[1] = { src: upload.publicUrl, alt: "Hi" })),
        );
        expect((await about()).story.photos[1]).toEqual({ src: upload.publicUrl, alt: "Hi" });

        // Removed, it's today's photo again.
        saved(await save("story", (form) => (form.photos[1] = { src: "", alt: "" })));
        expect((await about()).story.photos[1]).toEqual(ABOUT_DEFAULTS.story.photos[1]);
      });

      it("saves the team photo", async () => {
        const upload = await arm.uploadPhoto({ purpose: "about-photo" });
        saved(await save("header", (form) => (form.teamPhoto = { src: upload.path, alt: ALT })));
        expect((await about()).header.teamPhoto).toEqual({ src: upload.publicUrl, alt: ALT });
      });

      it("refuses a replaced photo with blank alt text, or alt text over 150 characters", async () => {
        const upload = await arm.uploadPhoto({ purpose: "about-photo" });
        expect(
          await save("story", (form) => (form.photos[1] = { src: upload.path, alt: "  " })),
        ).toEqual({
          ok: false,
          error: { kind: "invalid", fieldErrors: { "photos.1.alt": [DESCRIBE] } },
        });
        expect(
          await save(
            "header",
            (form) => (form.teamPhoto = { src: upload.path, alt: "a".repeat(151) }),
          ),
        ).toEqual({
          ok: false,
          error: {
            kind: "invalid",
            fieldErrors: { "teamPhoto.alt": ["KEEP IT TO 150 CHARACTERS"] },
          },
        });
        expect(
          await save(
            "header",
            (form) => (form.teamPhoto = { src: upload.path, alt: "a".repeat(150) }),
          ),
        ).toMatchObject({ ok: true });
      });

      it("asks to wait for a photo whose file hasn't arrived", async () => {
        const upload = await arm.uploadPhoto({ purpose: "about-photo", send: false });
        expect(
          await save("story", (form) => (form.photos[0] = { src: upload.path, alt: ALT })),
        ).toEqual({
          ok: false,
          error: { kind: "invalid", fieldErrors: {}, formError: WAIT_FOR_UPLOADS },
        });
      });

      it.each([
        [
          "a Site page share image upload",
          () => arm.uploadPhoto({ purpose: "site-page-share-image" }),
        ],
        ["a Product photo upload", () => arm.uploadPhoto({ purpose: "product-photo" })],
        ["a path the Admin didn't upload", async () => ({ path: "/about/someone-else.webp" })],
      ])("refuses %s as a photo", async (_case, image) => {
        const { path } = await image();
        expect(await save("story", (form) => (form.photos[2] = { src: path, alt: ALT }))).toEqual({
          ok: false,
          error: { kind: "invalid", fieldErrors: { "photos.2.src": [NOT_UPLOADED] } },
        });
      });
    });

    it("refuses a save over a newer one, naming who saved it, and saves nothing", async () => {
      const stale = await seam.getAboutForAdmin(EDITOR);
      later();
      saved(await save("story", (form) => (form.heading = "Saved first."), OWNER));
      const form = aboutSectionFormValues(stale.about, "story");
      form.heading = HEADING;
      expect(await seam.updateAboutSection(EDITOR, form, stale.stamps.story)).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: at(MINUTE).toISOString() },
      });
      expect((await about()).story.heading).toBe("Saved first.");
    });

    it("keeps each section's stamp its own: saving Header never makes Story's editor conflict", async () => {
      const opened = await seam.getAboutForAdmin(EDITOR);
      later();
      saved(await save("header", (form) => (form.intro = "Hello."), OWNER));
      const form = aboutSectionFormValues(opened.about, "story");
      form.heading = HEADING;
      saved(await seam.updateAboutSection(EDITOR, form, opened.stamps.story));
      // Story's save kept the Header's text.
      expect((await about()).header.intro).toBe("Hello.");
    });
  });
});
